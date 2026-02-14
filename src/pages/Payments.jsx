
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import "./Payments.css";

// Pricing Constants (Used for display fallback if needed, but mainly backend handles this now)
const PRICING = {
    // Delegate Solo Pricing
    "School Solo Delegates": { base: 999 },
    "Internal Solo Delegates": { "1st Year": 999, default: 1299 },
    "External Solo Delegates": { "1st Year": 1199, default: 1399 },

    // Delegate Group Pricing (per delegate)
    "School Group Delegation": { perMember: 859 },
    "Internal Group Delegation": { perMember: 1199 },
    "External Group Delegation": { perMember: 1299 },

    // OC Pricing
    "Internal OC": { "1st Year": 799, default: 899 },
    "External OC": { "1st Year": 899, default: 999 },
};

function Payments() {
    const [searchParams] = useSearchParams();
    const refId = searchParams.get("ref");
    const [qrUrl, setQrUrl] = useState("");
    const [utr, setUtr] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [delegateName, setDelegateName] = useState("");
    const [registrationData, setRegistrationData] = useState(null);
    const [amount, setAmount] = useState(0);

    useEffect(() => {
        if (!refId) return;

        const fetchDetailsAndGenerateQR = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/payments/${refId}`);
                const result = await response.json();

                if (!result.success) {
                    console.error(result.error);
                    return;
                }

                const data = result.data;
                setRegistrationData(data);
                setAmount(data.amountToPay);

                // Set display name
                if (data.isGroup && data.memberNames) {
                    setDelegateName(data.memberNames.join(", "));
                } else {
                    setDelegateName(data.name);
                }

                // Check if already paid
                if (data.utr && data.utr !== "-" && data.utr.length > 5) {
                    setUtr(data.utr);
                    setSuccess(true);
                }

                const calculatedAmount = data.amountToPay;
                const upiLink = `upi://pay?pa=cheerfulsathvika6102@okaxis&pn=Konda Naga sathvika&am=${calculatedAmount}&tn=Reg Fee ${refId}&tr=${refId}`;

                QRCode.toDataURL(upiLink)
                    .then((url) => setQrUrl(url))
                    .catch((err) => console.error("QR Code generation failed", err));

            } catch (error) {
                console.error("Error fetching details:", error);
            }
        };

        fetchDetailsAndGenerateQR();
    }, [refId]);

    const submitPayment = async () => {
        if (!utr.trim()) {
            alert("Please enter your UPI Transaction ID (UTR)");
            return;
        }

        if (!/^\d{12}$/.test(utr.trim())) {
            alert("Please enter a valid 12-digit UTR number.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/payments/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refId,
                    utr: utr.trim(),
                }),
            });

            const result = await response.json();

            if (result.success) {
                setSuccess(true);
                alert("✅ Payment recorded successfully!");
            } else {
                alert("❌ Failed to record payment: " + (result.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Payment update failed:", error);
            alert("❌ Failed to record payment. Please try again.");
        }

        setLoading(false);
    };

    const getRegistrationTypeLabel = () => {
        if (!registrationData) return "";
        if (registrationData.isGroup) {
            return `${registrationData.registrationType} (${registrationData.groupSize} members)`;
        }
        return registrationData.registrationType;
    };

    return (
        <div className="payment-page">
            <div className="payment-box">
                <h2>MUN IARE – Registration Fee</h2>
                <p className="info">
                    Welcome, <b>{delegateName}</b><br />
                    {registrationData?.isGroup && (
                        <span className="group-badge">Group Registration - {registrationData.groupSize} members</span>
                    )}<br />
                    Scan the QR code and complete the payment.<br />
                    After payment, enter your UPI Transaction ID (UTR).
                </p>

                <div id="qr">
                    {qrUrl ? (
                        <img src={qrUrl} alt="Payment QR Code" />
                    ) : (
                        <p>Loading Payment Details...</p>
                    )}
                </div>

                <p className="info">
                    Registration Type: <b>{getRegistrationTypeLabel()}</b><br />
                    Amount: <b>₹{amount}</b><br />
                    Reference: <b>{refId || "N/A"}</b>
                </p>

                {registrationData?.isGroup && (
                    <div className="group-breakdown">
                        <p>₹{PRICING[registrationData.registrationType]?.perMember || 0} × {registrationData.groupSize} members = ₹{amount}</p>
                    </div>
                )}

                {!success ? (
                    <>
                        <input
                            type="text"
                            placeholder="Enter UPI Transaction ID (UTR)"
                            value={utr}
                            onChange={(e) => setUtr(e.target.value)}
                            className="utr-input"
                        />
                        <button className="btn-payment" onClick={submitPayment} disabled={loading || !refId || amount === 0}>
                            {loading ? "Submitting..." : "Submit Payment"}
                        </button>
                    </>
                ) : (
                    <div id="paymentReceipt">
                        <h3>Payment Receipt</h3>
                        <p><b>Reference ID:</b> {refId}</p>
                        <p><b>Amount Paid:</b> ₹{amount}</p>
                        <p><b>UTR:</b> {utr}</p>
                        <p><b>Date:</b> {new Date().toLocaleString()}</p>
                    </div>
                )}

                <p className="note">
                    Your registration confirmation mail will be sent after payment verification.
                </p>
            </div>
        </div>
    );
}

export default Payments;
