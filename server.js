require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sql, getPool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
function validateEmployee(body, { partial = false } = {}) {
  const errors = [];
  const { EmployeeName, Email, Department, Designation, Salary } = body;

  if (!partial || EmployeeName !== undefined) {
    if (!EmployeeName || !EmployeeName.trim()) errors.push('Employee Name is required.');
  }
  if (!partial || Email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!Email || !emailRegex.test(Email)) errors.push('A valid Email is required.');
  }
  if (!partial || Department !== undefined) {
    if (!Department || !Department.trim()) errors.push('Department is required.');
  }
  if (!partial || Designation !== undefined) {
    if (!Designation || !Designation.trim()) errors.push('Designation is required.');
  }
  if (!partial || Salary !== undefined) {
    if (Salary === undefined || Salary === null || isNaN(Salary) || Number(Salary) < 0) {
      errors.push('Salary must be a non-negative number.');
    }
  }
  return errors;
}

// ---------- Routes ----------

// Health check (useful for Azure "Test connection")
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// READ (list + search) - /api/employees?search=text
app.get('/api/employees', async (req, res) => {
  try {
    const pool = await getPool();
    const search = (req.query.search || '').trim();
    const request = pool.request();
    let query = 'SELECT EmployeeID, EmployeeName, Email, Department, Designation, Salary FROM Employee';

    if (search) {
      query += ` WHERE EmployeeName LIKE @search OR Email LIKE @search
                 OR Department LIKE @search OR Designation LIKE @search`;
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    query += ' ORDER BY EmployeeID DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ single
app.get('/api/employees/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM Employee WHERE EmployeeID = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE
app.post('/api/employees', async (req, res) => {
  const errors = validateEmployee(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { EmployeeName, Email, Department, Designation, Salary } = req.body;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('EmployeeName', sql.NVarChar, EmployeeName.trim())
      .input('Email', sql.NVarChar, Email.trim())
      .input('Department', sql.NVarChar, Department.trim())
      .input('Designation', sql.NVarChar, Designation.trim())
      .input('Salary', sql.Decimal(12, 2), Salary)
      .query(`INSERT INTO Employee (EmployeeName, Email, Department, Designation, Salary)
              OUTPUT INSERTED.*
              VALUES (@EmployeeName, @Email, @Department, @Designation, @Salary)`);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ error: 'An employee with this email already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// UPDATE
app.put('/api/employees/:id', async (req, res) => {
  const errors = validateEmployee(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { EmployeeName, Email, Department, Designation, Salary } = req.body;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('EmployeeName', sql.NVarChar, EmployeeName.trim())
      .input('Email', sql.NVarChar, Email.trim())
      .input('Department', sql.NVarChar, Department.trim())
      .input('Designation', sql.NVarChar, Designation.trim())
      .input('Salary', sql.Decimal(12, 2), Salary)
      .query(`UPDATE Employee SET
                EmployeeName = @EmployeeName,
                Email = @Email,
                Department = @Department,
                Designation = @Designation,
                Salary = @Salary
              OUTPUT INSERTED.*
              WHERE EmployeeID = @id`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ error: 'An employee with this email already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Employee OUTPUT DELETED.EmployeeID WHERE EmployeeID = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    res.json({ message: 'Employee deleted successfully.', EmployeeID: result.recordset[0].EmployeeID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html for any other GET (SPA-style)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
