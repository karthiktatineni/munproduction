
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth } from "../firebase";
import { staticCountryData } from "../data/committees";
import "./Admin.css";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import {
    LayoutDashboard, Users, CheckCircle, Globe, CreditCard, Search, LogOut, FileText, UserCog
} from 'lucide-react';

function Admin() {
    const [delegates, setDelegates] = useState([]);
    const [ocMembers, setOcMembers] = useState([]);
    const [countryData, setCountryData] = useState(staticCountryData);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState("home");
    const [notification, setNotification] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setNotification(null);
        try {
            console.log("Attempting login with session persistence...");
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Login promise resolved");
        } catch (err) {
            console.error("Login error:", err);
            setNotification(err.message || "Invalid credentials!");
        } finally {
            setIsLoggingIn(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
            if (currentUser) {
                fetchAndAllocate();
            }
        });

        const handleTabClose = () => {
        };
        window.addEventListener('beforeunload', handleTabClose);

        return () => {
            unsubscribe();
            window.removeEventListener('beforeunload', handleTabClose);
        };
    }, []);

    // Inactivity Timeout (5 minutes)
    useEffect(() => {
        if (!user) return;

        let inactivityTimer;
        const INACTIVITY_LIMIT = 5 * 60 * 1000;

        const resetTimer = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                handleLogout();
                setNotification("Session expired due to 5 minutes of inactivity.");
            }, INACTIVITY_LIMIT);
        };

        const activityEvents = [
            'mousedown', 'mousemove', 'keydown',
            'scroll', 'touchstart', 'click'
        ];

        activityEvents.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        resetTimer();

        return () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            activityEvents.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [user]);

    const fetchAndAllocate = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/data`);
            const data = await response.json();

            if (!data.success) {
                throw new Error("Failed to fetch data");
            }

            const delegateList = data.delegates;
            const ocList = data.ocMembers;

            delegateList.sort((a, b) => {
                const awardsA = parseInt(a.munAwards || 0);
                const awardsB = parseInt(b.munAwards || 0);
                if (awardsA !== awardsB) return awardsB - awardsA;

                const expA = parseInt(a.munExperiences || 0);
                const expB = parseInt(b.munExperiences || 0);
                if (expA !== expB) return expB - expA;

                return new Date(a.timestamp) - new Date(b.timestamp);
            });

            setOcMembers(ocList);

            const newCountryData = {};
            Object.keys(staticCountryData).forEach(committee => {
                newCountryData[committee] = staticCountryData[committee].map(c => ({
                    ...c,
                    is_allocated: false,
                    allocated_to: null
                }));
            });

            // 1. Mark CONFIRMED allocations in matrix
            delegateList.forEach(delegate => {
                if (delegate.allocation) {
                    const { committee, country } = delegate.allocation;
                    const index = newCountryData[committee]?.findIndex(c => c.country === country);
                    if (index !== -1) {
                        newCountryData[committee][index].is_allocated = true;
                        newCountryData[committee][index].allocated_to = delegate.name;
                    }
                }
            });

            // 2. Calculate SUGGESTIONS (Virtual Allocation)
            const virtualMatrix = JSON.parse(JSON.stringify(newCountryData));

            delegateList.forEach(delegate => {
                if (delegate.allocation) return; // Already allocated
                if (!delegate.preferences) return;

                for (const pref of delegate.preferences) {
                    const committee = pref.committee;
                    if (!committee) continue;

                    for (const country of pref.countries) {
                        if (!country) continue;

                        const index = virtualMatrix[committee]?.findIndex(
                            c => c.country === country
                        );
                        if (
                            index !== -1 &&
                            !virtualMatrix[committee][index].is_allocated
                        ) {
                            // Found a spot
                            virtualMatrix[committee][index].is_allocated = true;
                            virtualMatrix[committee][index].allocated_to = delegate.name;
                            delegate.suggestedAllocation = { committee, country };
                            return; // Move to next delegate
                        }
                    }
                }
            });

            setDelegates(delegateList);
            setCountryData(newCountryData);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setNotification("Error fetching delegates!");
            setLoading(false);
        }
    };

    const handleAllocate = async (delegateId, docId, membersArray, memberIndex, suggested) => {
        if (!suggested) {
            alert("No allocation suggested (seats might be full or preferences unavailable).");
            return;
        }

        try {
            // Update Public Matrix State
            const newMatrix = { ...countryData };
            const { committee, country } = suggested;
            const cIndex = newMatrix[committee].findIndex(c => c.country === country);
            if (cIndex !== -1) {
                newMatrix[committee][cIndex].is_allocated = true;
                newMatrix[committee][cIndex].allocated_to = delegates.find(d => d.id === delegateId)?.name;
            }

            let membersToUpdate = null;
            let allocationToUpdate = null;

            if (membersArray) {
                // Determine group members from state to update DB
                const groupMembersInState = delegates.filter(d => d.docId === docId);
                // Map to Firestore format
                membersToUpdate = groupMembersInState.sort((a, b) => a.memberIndex - b.memberIndex).map(d => ({
                    name: d.name,
                    email: d.email,
                    phone: d.phone,
                    college: d.college,
                    yearOfStudy: d.yearOfStudy,
                    rollNumber: d.rollNumber,
                    munExperiences: d.munExperiences,
                    munAwards: d.munAwards,
                    preferences: d.preferences,
                    allocation: (d.memberIndex === memberIndex) ? suggested : d.allocation, // Update target
                    memberIndex: d.memberIndex,
                    registrationType: d.registrationType
                }));
            } else {
                allocationToUpdate = suggested;
            }

            // Call Backend
            const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/allocate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docId,
                    members: membersToUpdate,
                    allocation: allocationToUpdate,
                    matrix: newMatrix
                })
            });

            if (!response.ok) throw new Error("Backend allocation failed");

            // Update Local State
            setCountryData(newMatrix);
            setDelegates(prev => prev.map(d => {
                if (d.id === delegateId) {
                    return { ...d, allocation: suggested, suggestedAllocation: null };
                }
                return d;
            }));

            // Quick Recalculate Suggestions
            setDelegates(prevDelegates => {
                const updatedList = [...prevDelegates];
                const targetIndex = updatedList.findIndex(d => d.id === delegateId);
                if (targetIndex !== -1) {
                    updatedList[targetIndex].allocation = suggested;
                    updatedList[targetIndex].suggestedAllocation = null;
                }

                const virtualMatrix = JSON.parse(JSON.stringify(newMatrix));

                updatedList.forEach(del => {
                    if (del.allocation) return;

                    del.suggestedAllocation = null;
                    if (!del.preferences) return;

                    for (const pref of del.preferences) {
                        const comm = pref.committee;
                        if (!comm) continue;
                        for (const count of pref.countries) {
                            if (!count) continue;
                            const idx = virtualMatrix[comm]?.findIndex(c => c.country === count);
                            if (idx !== -1 && !virtualMatrix[comm][idx].is_allocated) {
                                virtualMatrix[comm][idx].is_allocated = true;
                                virtualMatrix[comm][idx].allocated_to = del.name;
                                del.suggestedAllocation = { committee: comm, country: count };
                                return;
                            }
                        }
                    }
                });
                return updatedList;
            });

        } catch (err) {
            console.error(err);
            alert("Failed to allocate.");
        }
    };

    const handleDeallocate = async (delegateId, docId, membersArray, memberIndex) => {
        if (!window.confirm("Are you sure you want to remove this allocation?")) return;

        try {
            const delegate = delegates.find(d => d.id === delegateId);
            if (!delegate || !delegate.allocation) return;

            const { committee, country } = delegate.allocation;

            // Updated Matrix
            const newMatrix = { ...countryData };
            const cIndex = newMatrix[committee]?.findIndex(c => c.country === country);
            if (cIndex !== -1) {
                newMatrix[committee][cIndex].is_allocated = false;
                newMatrix[committee][cIndex].allocated_to = null;
            }

            let membersToUpdate = null;

            if (membersArray) {
                const groupMembersInState = delegates.filter(d => d.docId === docId);
                membersToUpdate = groupMembersInState.sort((a, b) => a.memberIndex - b.memberIndex).map(d => ({
                    name: d.name,
                    email: d.email,
                    phone: d.phone,
                    college: d.college,
                    yearOfStudy: d.yearOfStudy,
                    rollNumber: d.rollNumber,
                    munExperiences: d.munExperiences,
                    munAwards: d.munAwards,
                    preferences: d.preferences,
                    allocation: (d.memberIndex === memberIndex) ? null : d.allocation,
                    memberIndex: d.memberIndex,
                    registrationType: d.registrationType
                }));
            }

            // Call Backend
            const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/deallocate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docId,
                    members: membersToUpdate,
                    matrix: newMatrix
                })
            });

            if (!response.ok) throw new Error("Backend deallocation failed");

            setCountryData(newMatrix);
            setDelegates(prev => prev.map(d => {
                if (d.id === delegateId) {
                    return { ...d, allocation: null, suggestedAllocation: null };
                }
                return d;
            }));

            alert("Allocation removed successfully.");

        } catch (err) {
            console.error(err);
            alert("Failed to remove allocation.");
        }
    };

    const verifyPayment = async (delegateId, isOC = false) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: delegateId, isOC })
            });

            if (!response.ok) throw new Error("Verification failed");

            if (isOC) {
                setOcMembers(prev =>
                    prev.map(d =>
                        d.id === delegateId ? { ...d, verified: true } : d
                    )
                );
            } else {
                setDelegates(prev =>
                    prev.map(d =>
                        d.docId === delegateId ? { ...d, verified: true } : d
                    )
                );
            }
            alert("Payment verified");
        } catch (err) {
            console.error(err);
            alert("Failed to verify payment");
        }
    };

    const exportToCSV = () => {
        if (delegates.length === 0) {
            alert("No data to export");
            return;
        }

        const headers = [
            "Reg Time", "Name", "Email", "Phone", "College/School", "Reg Type", "Year/Grade", "Roll No",
            "MUN Exp", "MUN Awards",
            "Group ID", "Group Size",
            "Pref 1: Committee", "Pref 1: Country 1", "Pref 1: Country 2", "Pref 1: Country 3",
            "Pref 2: Committee", "Pref 2: Country 1", "Pref 2: Country 2", "Pref 2: Country 3",
            "Pref 3: Committee", "Pref 3: Country 1", "Pref 3: Country 2", "Pref 3: Country 3",
            "Ref ID", "Amount", "UTR", "Paid At", "Status", "Allocation"
        ];

        const rows = delegates.map(d => {
            const prefsColumns = [];
            [0, 1, 2].forEach(i => {
                const p = d.preferences?.[i];
                if (p) {
                    prefsColumns.push(p.committee);
                    prefsColumns.push(p.countries[0] || "-");
                    prefsColumns.push(p.countries[1] || "-");
                    prefsColumns.push(p.countries[2] || "-");
                } else {
                    prefsColumns.push("-", "-", "-", "-");
                }
            });

            const allocationStr = d.allocation ? `${d.allocation.committee} (${d.allocation.country})` : "-";
            const paidAtStr = d.paidAt ? new Date(d.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }).replace(/,/g, "") : "-";

            return [
                new Date(d.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }).replace(/,/g, ""),
                d.name,
                d.email,
                d.phone,
                d.college,
                d.registrationType,
                d.yearOfStudy,
                d.rollNumber || "-",
                d.munExperiences || "0",
                d.munAwards || "0",
                d.groupId || "-",
                d.groupSize || "-",
                ...prefsColumns,
                d.refId,
                d.amountToPay,
                d.utr,
                paidAtStr,
                d.verified ? "Verified" : (d.utr !== "-" ? "Paid" : "Pending"),
                allocationStr
            ].map(field => `"${field}"`);
        });

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "delegates_data.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (authLoading)
        return <div className="admin-loading">Verifying Session...</div>;

    if (!user) {
        return (
            <div className="admin-login-overlay">
                <div className="login-card">
                    <h2>Admin Authentication</h2>
                    <form onSubmit={handleLogin}>
                        <input
                            type="email"
                            placeholder="Admin Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button type="submit" disabled={isLoggingIn}>
                            {isLoggingIn ? "Authenticating..." : "Unlock Dashboard"}
                        </button>
                    </form>
                    {notification && (
                        <div className="login-error">{notification}</div>
                    )}
                </div>
            </div>
        );
    }

    if (loading)
        return <div className="admin-loading">Loading Admin Panel...</div>;

    const paidDelegates = delegates.filter(d => d.utr !== "-");
    const verifiedDelegates = delegates.filter(d => d.verified);
    const groupDelegates = delegates.filter(d => d.isGroup);

    // eslint-disable-next-line no-unused-vars
    const soloDelegates = delegates.filter(d => !d.isGroup);

    // eslint-disable-next-line no-unused-vars
    const paidOC = ocMembers.filter(d => d.utr !== "-");
    // eslint-disable-next-line no-unused-vars
    const verifiedOC = ocMembers.filter(d => d.verified);

    const searchedDelegates = delegates.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.refId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.groupId && d.groupId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.rollNumber && d.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Chart Data Calculations
    const regTypeData = [
        { name: 'External Solo', value: delegates.filter(d => d.registrationType?.includes('External') && !d.isGroup).length },
        { name: 'Internal Solo', value: delegates.filter(d => d.registrationType?.includes('Internal') && !d.isGroup).length },
        { name: 'School Solo', value: delegates.filter(d => d.registrationType?.includes('School') && !d.isGroup).length },
        { name: 'External Group', value: delegates.filter(d => d.registrationType?.includes('External') && d.isGroup).length },
        { name: 'Internal Group', value: delegates.filter(d => d.registrationType?.includes('Internal') && d.isGroup).length },
        { name: 'School Group', value: delegates.filter(d => d.registrationType?.includes('School') && d.isGroup).length },
    ].filter(d => d.value > 0);

    const paymentData = [
        { name: 'Verified', value: verifiedDelegates.length },
        { name: 'Paid (Pending Verify)', value: paidDelegates.length - verifiedDelegates.length },
        { name: 'Not Paid', value: delegates.length - paidDelegates.length },
    ].filter(d => d.value > 0);

    const committeeStats = {};
    delegates.forEach(d => {
        if (d.allocation && d.allocation.committee) {
            committeeStats[d.allocation.committee] = (committeeStats[d.allocation.committee] || 0) + 1;
        }
    });

    // eslint-disable-next-line no-unused-vars
    const committeeData = Object.keys(committeeStats).map(name => ({
        name,
        count: committeeStats[name]
    }));

    const COLORS = ['#d4af37', '#4ade80', '#ff4444', '#00C49F', '#FFBB28', '#FF8042'];

    // Group delegates by groupId for display
    const groupedByGroupId = {};
    groupDelegates.forEach(d => {
        if (!groupedByGroupId[d.groupId]) {
            groupedByGroupId[d.groupId] = [];
        }
        groupedByGroupId[d.groupId].push(d);
    });

    return (
        <div className="admin-layout">
            {/* Sidebar Navigation */}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <div className="logo-icon">
                        <LayoutDashboard size={24} color="#d4af37" />
                    </div>
                    <h2>MUN Admin</h2>
                </div>

                <nav className="sidebar-nav">
                    <button
                        className={`nav-item ${selectedTab === "home" ? "active" : ""}`}
                        onClick={() => setSelectedTab("home")}
                    >
                        <LayoutDashboard size={18} />
                        <span>Overview</span>
                    </button>

                    <button
                        className={`nav-item ${selectedTab === "delegate_info" ? "active" : ""} `}
                        onClick={() => setSelectedTab("delegate_info")}
                    >
                        <FileText size={18} />
                        <span>Delegate Info</span>
                    </button>

                    <button
                        className={`nav-item ${selectedTab === "group_delegations" ? "active" : ""} `}
                        onClick={() => setSelectedTab("group_delegations")}
                    >
                        <Users size={18} />
                        <span>Group Delegations</span>
                    </button>

                    <button
                        className={`nav-item ${selectedTab === "oc_members" ? "active" : ""} `}
                        onClick={() => setSelectedTab("oc_members")}
                    >
                        <UserCog size={18} />
                        <span>OC Members</span>
                    </button>

                    <button
                        className={`nav-item ${selectedTab === "allocated_delegates" ? "active" : ""} `}
                        onClick={() => setSelectedTab("allocated_delegates")}
                    >
                        <Users size={18} />
                        <span>Allocated</span>
                    </button>

                    <button
                        className={`nav-item ${selectedTab === "countries" ? "active" : ""} `}
                        onClick={() => setSelectedTab("countries")}
                    >
                        <Globe size={18} />
                        <span>Countries</span>
                    </button>

                    <button
                        className={`nav-item ${selectedTab === "delegates" ? "active" : ""} `}
                        onClick={() => setSelectedTab("delegates")}
                    >
                        <CreditCard size={18} />
                        <span>Payments</span>
                    </button>

                    <button
                        className={`nav-item ${selectedTab === "verified" ? "active" : ""} `}
                        onClick={() => setSelectedTab("verified")}
                    >
                        <CheckCircle size={18} />
                        <span>Verified</span>
                    </button>

                    <button
                        className={`nav-item ${selectedTab === "search" ? "active" : ""} `}
                        onClick={() => setSelectedTab("search")}
                    >
                        <Search size={18} />
                        <span>Search</span>
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <button className="logout-btn-minimal" onClick={handleLogout}>
                        <LogOut size={16} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="admin-main-content">
                {notification && (
                    <div className="admin-notification-sticky">
                        <span>{notification}</span>
                        <button onClick={() => setNotification(null)}>×</button>
                    </div>
                )}

                <header className="content-header">
                    <div className="header-text">
                        <h1>Dashboard</h1>
                        <p>Welcome back, Admin</p>
                    </div>
                    <div className="header-actions">
                        <button className="logout-header-btn" onClick={handleLogout}>
                            <LogOut size={18} />
                            <span>Logout</span>
                        </button>
                    </div>
                </header>

                {selectedTab === "home" && (
                    <>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <h3>Total Delegates</h3>
                                <div className="value">{delegates.length}</div>
                            </div>
                            <div className="stat-card">
                                <h3>Verified Payments</h3>
                                <div className="value">{verifiedDelegates.length}</div>
                            </div>
                            <div className="stat-card">
                                <h3>Pending Payments</h3>
                                <div className="value">{paidDelegates.length - verifiedDelegates.length}</div>
                            </div>
                            <div className="stat-card">
                                <h3>OC Registrations</h3>
                                <div className="value">{ocMembers.length}</div>
                            </div>
                        </div>

                        <div className="charts-container">
                            <div className="chart-card">
                                <h3>Registrations by Type</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={regTypeData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="value" fill="#d4af37" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="chart-card">
                                <h3>Payment Status</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={paymentData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {paymentData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}

                {selectedTab === "delegate_info" && (
                    <div className="table-container">
                        <div className="table-header">
                            <h3>All Delegates</h3>
                            <button className="btn-export" onClick={exportToCSV}>Export CSV</button>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>College/School</th>
                                    <th>Type</th>
                                    <th>Year</th>
                                    <th>Roll No</th>
                                    <th>Exp</th>
                                    <th>Awards</th>
                                    <th>Docs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {delegates.map((d, i) => (
                                    <tr key={i}>
                                        <td>{d.name}</td>
                                        <td>{d.email}</td>
                                        <td>{d.phone}</td>
                                        <td>{d.college}</td>
                                        <td>{d.registrationType}</td>
                                        <td>{d.yearOfStudy}</td>
                                        <td>{d.rollNumber}</td>
                                        <td>{d.munExperiences}</td>
                                        <td>{d.munAwards}</td>
                                        <td>{d.isGroup ? "Group" : "Solo"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {selectedTab === "group_delegations" && (
                    <div className="table-container">
                        <h3>Group Delegations</h3>
                        {Object.keys(groupedByGroupId).length === 0 ? (
                            <p>No group delegations found.</p>
                        ) : (
                            Object.entries(groupedByGroupId).map(([groupId, members]) => (
                                <div key={groupId} className="group-block">
                                    <div className="group-header">
                                        <h4>Group ID: {groupId} ({members.length} members)</h4>
                                        <span className="badge">{members[0].registrationType}</span>
                                    </div>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Member</th>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Phone</th>
                                                <th>Ref ID</th>
                                                <th>UTR</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {members.sort((a, b) => a.memberIndex - b.memberIndex).map((member) => (
                                                <tr key={member.id}>
                                                    <td>Member {member.memberIndex}</td>
                                                    <td>{member.name}</td>
                                                    <td>{member.email}</td>
                                                    <td>{member.phone}</td>
                                                    <td>{member.refId}</td>
                                                    <td>{member.utr}</td>
                                                    <td>
                                                        <span className={`status-badge ${member.verified ? "verified" : "pending"}`}>
                                                            {member.verified ? "Verified" : "Pending"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {selectedTab === "oc_members" && (
                    <div className="table-container">
                        <h3>OC Members</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>College</th>
                                    <th>Type</th>
                                    <th>Ref ID</th>
                                    <th>UTR</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ocMembers.map((oc, i) => (
                                    <tr key={i}>
                                        <td>{oc.name}</td>
                                        <td>{oc.college}</td>
                                        <td>{oc.ocType}</td>
                                        <td>{oc.refId}</td>
                                        <td>{oc.utr}</td>
                                        <td>
                                            <span className={`status-badge ${oc.verified ? "verified" : "pending"}`}>
                                                {oc.verified ? "Verified" : (oc.utr !== "-" ? "Paid" : "Pending")}
                                            </span>
                                        </td>
                                        <td>
                                            {!oc.verified && oc.utr !== "-" && (
                                                <button
                                                    className="btn-verify"
                                                    onClick={() => verifyPayment(oc.id, true)}
                                                >
                                                    Verify
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {selectedTab === "allocated_delegates" && (
                    <div className="table-container">
                        <h3>Allocated Delegates</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>College</th>
                                    <th>Type</th>
                                    <th>Committee</th>
                                    <th>Country</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {delegates.filter(d => d.allocation).map((d) => (
                                    <tr key={d.id}>
                                        <td>{d.name}</td>
                                        <td>{d.college}</td>
                                        <td>{d.registrationType}</td>
                                        <td>{d.allocation.committee}</td>
                                        <td>{d.allocation.country}</td>
                                        <td>
                                            <button
                                                className="btn-deallocate"
                                                onClick={() => handleDeallocate(d.id, d.docId, d.isGroup, d.memberIndex)}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {selectedTab === "countries" && (
                    <div className="country-matrix">
                        <h3>Country Matrix</h3>
                        {Object.keys(countryData).map((committee) => (
                            <div key={committee} className="committee-block">
                                <h4>{committee}</h4>
                                <div className="country-grid">
                                    {countryData[committee].map((c, i) => (
                                        <div
                                            key={i}
                                            className={`country-card ${c.is_allocated ? "allocated" : "available"}`}
                                        >
                                            <span className="country-name">{c.country}</span>
                                            {c.is_allocated && (
                                                <span className="allocated-to">{c.allocated_to}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {selectedTab === "delegates" && (
                    <div className="table-container">
                        <h3>Payment Verification</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Ref ID</th>
                                    <th>Name</th>
                                    <th>Reg Type</th>
                                    <th>UTR</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Allocation</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {delegates.filter(d => d.utr !== "-").map((d) => (
                                    <tr key={d.id}>
                                        <td>{d.refId}</td>
                                        <td>{d.name}</td>
                                        <td>{d.registrationType}</td>
                                        <td>{d.utr}</td>
                                        <td>{d.amountToPay}</td>
                                        <td>
                                            <span className={`status-badge ${d.verified ? "verified" : "pending"}`}>
                                                {d.verified ? "Verified" : "Pending"}
                                            </span>
                                        </td>
                                        <td>
                                            {d.allocation ? (
                                                <span className="allocated-badge">
                                                    {d.allocation.committee} - {d.allocation.country}
                                                </span>
                                            ) : d.suggestedAllocation ? (
                                                <div className="suggestion-box">
                                                    <span>Suggested: {d.suggestedAllocation.committee} - {d.suggestedAllocation.country}</span>
                                                    <button
                                                        className="btn-allocate"
                                                        onClick={() => handleAllocate(d.id, d.docId, d.isGroup, d.memberIndex, d.suggestedAllocation)}
                                                    >
                                                        Allocate
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="no-suggestion">No suggestion</span>
                                            )}
                                        </td>
                                        <td>
                                            {!d.verified && (
                                                <button
                                                    className="btn-verify"
                                                    onClick={() => verifyPayment(d.docId, false)}
                                                >
                                                    Verify
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {selectedTab === "verified" && (
                    <div className="table-container">
                        <h3>Verified Delegates</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Ref ID</th>
                                    <th>UTR</th>
                                    <th>College</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {verifiedDelegates.map((d) => (
                                    <tr key={d.id}>
                                        <td>{d.name}</td>
                                        <td>{d.refId}</td>
                                        <td>{d.utr}</td>
                                        <td>{d.college}</td>
                                        <td>
                                            {!d.allocation && d.suggestedAllocation && (
                                                <button
                                                    className="btn-allocate"
                                                    onClick={() => handleAllocate(d.id, d.docId, d.isGroup, d.memberIndex, d.suggestedAllocation)}
                                                >
                                                    Allocate
                                                </button>
                                            )}
                                            {d.allocation && (
                                                <button
                                                    className="btn-deallocate"
                                                    onClick={() => handleDeallocate(d.id, d.docId, d.isGroup, d.memberIndex)}
                                                >
                                                    Deallocate
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {selectedTab === "search" && (
                    <div>
                        <div className="search-bar">
                            <Search size={20} />
                            <input
                                type="text"
                                placeholder="Search by name, email, ref ID, group ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="table-container">
                            <h3>Search Results</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Ref ID</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchedDelegates.map((d) => (
                                        <tr key={d.id}>
                                            <td>{d.name}</td>
                                            <td>{d.email}</td>
                                            <td>{d.refId}</td>
                                            <td>
                                                <span className={`status-badge ${d.verified ? "verified" : (d.utr !== "-" ? "paid" : "pending")}`}>
                                                    {d.verified ? "Verified" : (d.utr !== "-" ? "Paid" : "Pending")}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}

export default Admin;
