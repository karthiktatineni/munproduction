
import { db, admin } from "../config/firebase.js";

export const registerOC = async (req, res) => {
    try {
        const data = req.body;

        if (!data.name || !data.email || !data.phone || !data.college || !data.ocType || !data.yearOfStudy) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (data.ocType === "Internal OC" && !data.rollNumber) {
            return res.status(400).json({ error: "Roll Number is required for Internal OC" });
        }

        const refId = "MUNOC" + Date.now();

        const docRef = await db.collection("oc_registrations").add({
            ...data,
            registrationType: data.ocType,
            refId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({
            success: true,
            message: "OC Registration successful",
            refId,
            id: docRef.id
        });
    } catch (error) {
        console.error("Error registering OC:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
