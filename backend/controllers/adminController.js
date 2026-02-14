
import { db } from "../config/firebase.js";

export const getAdminData = async (req, res) => {
    try {
        const querySnapshot = await db.collection("registrations").get();
        const delegateList = [];

        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();

            if (data.isGroup && data.members) {
                data.members.forEach((member, idx) => {
                    delegateList.push({
                        id: docSnap.id + "_" + idx,
                        docId: docSnap.id,
                        name: member.name,
                        email: member.email,
                        college: data.college,
                        phone: member.phone,
                        registrationType: data.registrationType,
                        yearOfStudy: member.yearOfStudy,
                        rollNumber: member.rollNumber || "-",
                        munExperiences: member.munExperiences || "0",
                        munAwards: member.munAwards || "0",
                        amountToPay: data.amountToPay || "-",
                        refId: data.refId || "-",
                        utr: data.utr || "-",
                        verified: data.verified || false,
                        timestamp: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : (data.timestamp || new Date(0).toISOString()),
                        paidAt: data.paidAt?.toDate?.() ? data.paidAt.toDate().toISOString() : null,
                        preferences: member.preferences || [],
                        allocation: member.allocation || null,
                        suggestedAllocation: null,
                        isGroup: true,
                        groupId: data.groupId,
                        groupSize: data.groupSize,
                        memberIndex: idx + 1,
                        memberNames: data.memberNames
                    });
                });
            } else {
                delegateList.push({
                    id: docSnap.id,
                    docId: docSnap.id,
                    name: data.name,
                    email: data.email,
                    college: data.college,
                    phone: data.phone,
                    registrationType: data.registrationType || "-",
                    yearOfStudy: data.yearOfStudy || "-",
                    rollNumber: data.rollNumber || "-",
                    munExperiences: data.munExperiences || "0",
                    munAwards: data.munAwards || "0",
                    amountToPay: data.amountToPay || "-",
                    refId: data.refId || "-",
                    utr: data.utr || "-",
                    verified: data.verified || false,
                    timestamp: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : (data.timestamp || new Date(0).toISOString()),
                    paidAt: data.paidAt?.toDate?.() ? data.paidAt.toDate().toISOString() : null,
                    preferences: data.preferences || [],
                    allocation: data.allocation || null,
                    suggestedAllocation: null,
                    isGroup: false,
                    groupId: null
                });
            }
        });

        const ocSnapshot = await db.collection("oc_registrations").get();
        const ocList = [];
        ocSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            ocList.push({
                id: docSnap.id,
                name: data.name,
                email: data.email,
                college: data.college,
                phone: data.phone,
                ocType: data.ocType || data.registrationType || "-",
                yearOfStudy: data.yearOfStudy || "-",
                rollNumber: data.rollNumber || "-",
                amountToPay: data.amountToPay || "-",
                refId: data.refId || "-",
                utr: data.utr || "-",
                verified: data.verified || false,
                timestamp: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
            });
        });
        ocList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        res.json({
            success: true,
            delegates: delegateList,
            ocMembers: ocList
        });

    } catch (error) {
        console.error("Error fetching admin data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const allocateDelegate = async (req, res) => {
    try {
        const { docId, members, allocation, matrix } = req.body;

        if (members) {
            await db.collection("registrations").doc(docId).update({
                members: members
            });
        } else if (allocation) {
            await db.collection("registrations").doc(docId).update({
                allocation: allocation
            });
        }

        if (matrix) {
            await db.collection("public").doc("countryMatrix").set({
                matrix: matrix,
                lastUpdated: new Date().toISOString()
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error allocating:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deallocateDelegate = async (req, res) => {
    try {
        const { docId, members, matrix } = req.body;

        if (members) {
            await db.collection("registrations").doc(docId).update({
                members: members
            });
        } else {
            await db.collection("registrations").doc(docId).update({
                allocation: null
            });
        }

        if (matrix) {
            await db.collection("public").doc("countryMatrix").set({
                matrix: matrix,
                lastUpdated: new Date().toISOString()
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error deallocating:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const { id, isOC } = req.body;
        const collectionName = isOC ? "oc_registrations" : "registrations";
        if (!id) return res.status(400).json({ error: "Missing document ID" });

        await db.collection(collectionName).doc(id).update({
            verified: true
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error verifying:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
