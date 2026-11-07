-- SQL Server table definitions. Import matching CSVs with the SSMS Import Flat File wizard.
CREATE TABLE items (
    item_id VARCHAR(80) NOT NULL,
    category VARCHAR(80) NOT NULL,
    supplier_id VARCHAR(80) NOT NULL,
    unit_cost FLOAT NOT NULL,
    pack_size FLOAT NOT NULL,
    lead_days FLOAT NOT NULL,
    daily_mean FLOAT NOT NULL,
    location VARCHAR(80) NOT NULL
);

CREATE TABLE usage (
    item_id VARCHAR(80) NOT NULL,
    month VARCHAR(80) NOT NULL,
    period VARCHAR(80) NOT NULL,
    quantity FLOAT NOT NULL
);

CREATE TABLE purchases (
    transaction_id VARCHAR(80) NOT NULL,
    item_id VARCHAR(80) NOT NULL,
    month VARCHAR(80) NOT NULL,
    quantity FLOAT NOT NULL,
    unit_cost FLOAT NOT NULL,
    spend FLOAT NOT NULL
);

CREATE TABLE policy_results (
    item_id VARCHAR(80) NOT NULL,
    category VARCHAR(80) NOT NULL,
    location VARCHAR(80) NOT NULL,
    policy VARCHAR(80) NOT NULL,
    order_qty FLOAT NOT NULL,
    reorder_point FLOAT NOT NULL,
    demand_units FLOAT NOT NULL,
    filled_units FLOAT NOT NULL,
    lost_units FLOAT NOT NULL,
    fill_rate FLOAT NOT NULL,
    avg_inventory_value FLOAT NOT NULL,
    freight FLOAT NOT NULL,
    holding_cost FLOAT NOT NULL,
    shortage_penalty FLOAT NOT NULL,
    discount_benefit FLOAT NOT NULL,
    relevant_cost FLOAT NOT NULL,
    opening_units FLOAT NOT NULL,
    received_units FLOAT NOT NULL,
    ending_units FLOAT NOT NULL,
    training_daily_mean FLOAT NOT NULL,
    unit_cost FLOAT NOT NULL
);
