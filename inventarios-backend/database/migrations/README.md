# Database Migrations

This directory contains SQL migration scripts for the inventory system.

## How to Apply Migrations

### Using MySQL Command Line

```bash
mysql -u root -p < database/migrations/001_add_almacen_to_counts.sql
```

### Using phpMyAdmin

1. Open phpMyAdmin in your browser
2. Select the `inventarios` database
3. Click on the "SQL" tab
4. Copy and paste the contents of the migration file
5. Click "Go" to execute

### Using MySQL Workbench

1. Open MySQL Workbench
2. Connect to your database server
3. Open the migration file
4. Execute the script

## Migration 001: Add almacen field to counts table

**Purpose**: Track which warehouse (almacén) is being counted for each inventory count.

**Changes**:
- Adds `almacen` column to `counts` table (INT, default 1, NOT NULL)
- Adds index on `almacen` column for better query performance
- Almacen 1 = Main branch (sucursal principal)
- Almacen 2+ = Warehouses (bodegas)

**Impact**:
- Existing count records will default to `almacen = 1` (main branch)
- History tracking will now differentiate between warehouses
- Frontend will send the selected warehouse when creating counts

**Rollback** (if needed):
```sql
ALTER TABLE counts DROP COLUMN almacen;
```
