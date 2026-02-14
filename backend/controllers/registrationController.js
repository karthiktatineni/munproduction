
import { db, admin } from "../config/firebase.js";

export const registerSolo = async (req, res) => {
    try {
        const data = req.body;
        const refId = "MUNIARE" + Date.now();

        await db.collection("registrations").add({
            ...data,
            isGroup: false,
            refId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({ success: true, message: "Registration successful", refId });
    } catch (error) {
        console.error("Error in solo registration:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const registerGroup = async (req, res) => {
    try {
        const data = req.body;
        const refId = "MUNIARE" + Date.now();

        await db.collection("registrations").add({
            ...data,
            isGroup: true,
            refId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({ success: true, message: "Group registration successful", refId });
    } catch (error) {
        console.error("Error in group registration:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
