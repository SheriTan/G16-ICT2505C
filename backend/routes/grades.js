import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// GET /api/grades?teamId=X — fetch all grades for one team
router.get("/", async (req, res) => {
  try {
    const iid = req.session.user?.iid;
    if (!iid) return res.status(401).json({ success: false, message: "Unauthorized User" });

    const { teamId } = req.query;
    if (!teamId) return res.status(400).json({ success: false, message: "teamId required" });

    // JOIN with team table so instructors can only see grades for their own teams
    const [rows] = await pool.query(
      `SELECT g.gid, g.tid, g.gradeComp, g.gradeScore
       FROM grade g
       JOIN team t ON g.tid = t.tid
       WHERE g.tid = ? AND t.iid = ?`,
      [teamId, iid]
    );

    res.json({ success: true, grades: rows });

  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/grades — add a new grade entry for a team
router.post("/", async (req, res) => {
  try {
    const iid = req.session.user?.iid;
    if (!iid) return res.status(401).json({ success: false, message: "Unauthorized User" });

    const { teamId, gradeComp, gradeScore } = req.body;

    if (!teamId || !gradeComp || gradeScore === undefined) {
      return res.status(400).json({ success: false, message: "teamId, gradeComp and gradeScore are required" });
    }

    // Verify the team belongs to this instructor before inserting
    const [teamRows] = await pool.query(
      "SELECT tid FROM team WHERE tid = ? AND iid = ?",
      [teamId, iid]
    );
    if (!teamRows.length) {
      return res.status(404).json({ success: false, message: "Team not found or not owned by user" });
    }

    const [result] = await pool.query(
      "INSERT INTO grade (tid, gradeComp, gradeScore) VALUES (?, ?, ?)",
      [teamId, gradeComp, gradeScore]
    );

    res.json({ success: true, gid: result.insertId });

  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /api/grades/:gid — update the component name or score for an existing grade
router.put("/:gid", async (req, res) => {
  try {
    const iid = req.session.user?.iid;
    if (!iid) return res.status(401).json({ success: false, message: "Unauthorized User" });

    const { gradeComp, gradeScore } = req.body;

    const [result] = await pool.query(
      // JOIN ensures only the owning instructor can update this grade
      `UPDATE grade g
       JOIN team t ON g.tid = t.tid
       SET g.gradeComp = ?, g.gradeScore = ?
       WHERE g.gid = ? AND t.iid = ?`,
      [gradeComp, gradeScore, req.params.gid, iid]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Grade not found" });
    }

    res.json({ success: true, updated: result.affectedRows });

  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE /api/grades/:gid — remove a single grade entry
router.delete("/:gid", async (req, res) => {
  try {
    const iid = req.session.user?.iid;
    if (!iid) return res.status(401).json({ success: false, message: "Unauthorized User" });

    // JOIN ensures the grade belongs to a team owned by this instructor
    const [result] = await pool.query(
      `DELETE g FROM grade g
       JOIN team t ON g.tid = t.tid
       WHERE g.gid = ? AND t.iid = ?`,
      [req.params.gid, iid]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Grade not found" });
    }

    res.json({ success: true });

  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
