DROP TABLE IF EXISTS menu_item_ingredients;
ALTER TABLE menu_items ADD COLUMN inventory_item_id INTEGER REFERENCES inventory(id);
