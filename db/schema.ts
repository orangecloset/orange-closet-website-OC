import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    brand: text("brand"),
    type: text("type").notNull(),
    category: text("category").notNull(),
    categoryLabel: text("category_label").notNull(),
    price: text("price").notNull(),
    compareAtPrice: text("compare_at_price"),
    colors: jsonb("colors").notNull().default([]),
    sizes: jsonb("sizes").notNull().default([]),
    status: text("status").notNull().default("active"),
    sections: jsonb("sections").notNull().default([]),
    sectionsOpen: boolean("sections_open").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("products_status_idx").on(table.status),
    index("products_type_idx").on(table.type),
    index("products_created_at_idx").on(table.createdAt),
    index("products_name_idx").on(table.name),
  ]
);

export const sales = pgTable(
  "sales",
  {
    id: text("id").primaryKey(),
    receiptNo: text("receipt_no").notNull().default(""),
    productId: text("product_id"),
    productName: text("product_name").notNull(),
    productImage: text("product_image"),
    colorName: text("color_name").notNull(),
    size: text("size").notNull(),
    quantity: integer("quantity").notNull(),
    price: text("price").notNull(),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    soldBy: text("sold_by"),
    paymentMethod: text("payment_method"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sales_created_at_idx").on(table.createdAt)]
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const catalogLinks = pgTable("catalog_links", {
  uid: text("uid").primaryKey(),
  pin: text("pin").notNull(),
  pinEnc: text("pin_enc"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
