import express from "express";
import pool from "../config/db.js";
import bcrypt from "bcrypt";
const router = express.Router();

router.get("/session", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ authenticated: false });
    }

    res.json({ authenticated: true, user: req.session.user });
});

// Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await pool.query(
            "SELECT * FROM instructor WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const user = rows[0];

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        req.session.user = {
            iid: user.iid,
            email: user.email
        };

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// Register
router.post("/register", async (req, res) => {
    const { email, password, jiraToken, githubToken } = req.body;

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const key = process.env.SECRET_KEY;

        const [result] = await pool.query(
            `INSERT INTO instructor (email, passwordHash, jiraToken, githubToken)
             VALUES (
               ?,
               ?,
               ${jiraToken  ? "AES_ENCRYPT(?, ?)" : "NULL"},
               ${githubToken ? "AES_ENCRYPT(?, ?)" : "NULL"}
             )`,
            [
                email,
                passwordHash,
                ...(jiraToken  ? [jiraToken,  key] : []),
                ...(githubToken ? [githubToken, key] : []),
            ]
        );

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

// Get profile
router.get("/profile", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized User" });
    }

    const [rows] = await pool.query(
        `SELECT email,
        AES_DECRYPT(jiraToken, ?) AS jiraToken,
        AES_DECRYPT(githubToken, ?) AS githubToken
        FROM instructor
        WHERE iid = ?`,
        [process.env.SECRET_KEY, process.env.SECRET_KEY, req.session.user.iid]
    );

    if (rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    res.json({
        email: user.email,
        jiraToken:    user.jiraToken?.toString()    || "",
        githubToken:  user.githubToken?.toString()  || ""
    });
});

// Update profile
router.put("/profile", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized User" });
    }

    const { email, jiraToken, githubToken } = req.body;
    const key = process.env.SECRET_KEY;

    try {
        await pool.query(
            `UPDATE instructor
             SET email = ?,
                 jiraToken  = ${jiraToken  ? "AES_ENCRYPT(?, ?)" : "NULL"},
                 githubToken = ${githubToken ? "AES_ENCRYPT(?, ?)" : "NULL"}
             WHERE iid = ?`,
            [
                email,
                ...(jiraToken  ? [jiraToken,  key] : []),
                ...(githubToken ? [githubToken, key] : []),
                req.session.user.iid,
            ]
        );

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ message: "Update failed" });
    }
});

export default router;