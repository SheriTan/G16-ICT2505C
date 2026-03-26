import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// Check session
router.get("/session", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ authenticated: false });
    }

    res.json({ authenticated: true, user: req.session.user });
});

// Login
router.post("/login", async (req, res) => {
    const { email } = req.body;

    const [rows] = await pool.query(
        "SELECT * FROM instructor WHERE email = ?",
        [email]
    );

    if (rows.length === 0) {
        return res.status(401).json({ success: false, message: "User not found" });
    }

    const user = rows[0];

    req.session.user = {
        iid: user.iid,
        email: user.email
    };

    res.json({ success: true });
});

// Register
router.post("/register", async (req, res) => {
    const { email, jiraToken, githubToken } = req.body;

    try {
        const [result] = await pool.query(`
        INSERT INTO instructor (email, jiraToken, githubToken)
        VALUES (
        '${email}',
        ${jiraToken ? `AES_ENCRYPT('${jiraToken}', '${process.env.SECRET_KEY}')` : 'NULL'},
        ${githubToken ? `AES_ENCRYPT('${githubToken}', '${process.env.SECRET_KEY}')` : 'NULL'}
        )
        `);

        req.session.user = {
            iid: result.insertId,
            email
        };

        res.json({ success: true });

    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ success: false, message: "Email Address already exists" });
        }

        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Logout
router.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ success: true });
    });
});


export default router;