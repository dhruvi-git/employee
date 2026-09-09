-- Run this against your Azure SQL Database (EmployeeDB)
-- e.g. via Azure Portal Query Editor, Azure Data Studio, SSMS, or `sqlcmd`

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Employee')
BEGIN
    CREATE TABLE Employee (
        EmployeeID    INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeName  NVARCHAR(100) NOT NULL,
        Email         NVARCHAR(100) NOT NULL UNIQUE,
        Department    NVARCHAR(100) NOT NULL,
        Designation   NVARCHAR(100) NOT NULL,
        Salary        DECIMAL(12,2) NOT NULL CHECK (Salary >= 0)
    );
END

-- Optional: seed a couple of sample rows
INSERT INTO Employee (EmployeeName, Email, Department, Designation, Salary)
VALUES
('Asha Patel', 'asha.patel@example.com', 'Engineering', 'Software Engineer', 65000),
('Rohit Sharma', 'rohit.sharma@example.com', 'HR', 'HR Manager', 58000);
