import { randomUUID } from "node:crypto";

import { withServiceDatabase } from "./database.js";
import {
  isPostgresStorageEnabled,
  listCustomersFromPostgres,
  loadCustomerFromPostgres,
  upsertCustomerInPostgres,
} from "./postgres-repository.js";

export async function ensureCustomer({
  serviceStorageRoot,
  customerSlug,
  displayName,
  status,
  metadata,
  customerId,
} = {}) {
  const safeCustomerSlug = sanitizeSlug(customerSlug ?? "");
  if (!safeCustomerSlug) {
    return null;
  }

  const existing = await loadCustomer({
    serviceStorageRoot,
    customerSlug: safeCustomerSlug,
  });
  const existingByCustomerId = customerId
    ? await loadCustomer({
        serviceStorageRoot,
        customerId,
      })
    : null;
  const canonicalExisting = existing ?? existingByCustomerId;
  const now = new Date().toISOString();
  const customer = {
    schema_version: 1,
    customer_id: String(canonicalExisting?.customer_id ?? customerId ?? randomUUID()),
    customer_slug: safeCustomerSlug,
    display_name: String(displayName ?? canonicalExisting?.display_name ?? safeCustomerSlug).trim(),
    status: String(status ?? canonicalExisting?.status ?? "active").trim().toLowerCase(),
    created_at: canonicalExisting?.created_at ?? now,
    updated_at: now,
    metadata: {
      ...(canonicalExisting?.metadata ?? {}),
      ...(metadata ?? {}),
    },
  };

  if (isPostgresStorageEnabled()) {
    await upsertCustomerInPostgres({ customer });
  } else {
    withServiceDatabase(serviceStorageRoot, (database) => {
      const params = {
        customer_id: customer.customer_id,
        customer_slug: customer.customer_slug,
        display_name: customer.display_name,
        status: customer.status,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        payload_json: JSON.stringify(customer),
      };
      if (existingByCustomerId && !existing) {
        const result = database
          .prepare(`
            UPDATE customers
            SET
              customer_slug = ?,
              display_name = ?,
              status = ?,
              updated_at = ?,
              payload_json = ?
            WHERE customer_id = ?
          `)
          .run(
            params.customer_slug,
            params.display_name,
            params.status,
            params.updated_at,
            params.payload_json,
            params.customer_id,
          );
        if (Number(result.changes ?? 0) === 0) {
          throw new Error(`Failed to update customer ${params.customer_id}.`);
        }
        return;
      }

      try {
        database
          .prepare(`
            INSERT INTO customers (
              customer_id,
              customer_slug,
              display_name,
              status,
              created_at,
              updated_at,
              payload_json
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?
            )
            ON CONFLICT(customer_slug) DO UPDATE SET
              display_name = excluded.display_name,
              status = excluded.status,
              updated_at = excluded.updated_at,
              payload_json = excluded.payload_json
          `)
          .run(
            params.customer_id,
            params.customer_slug,
            params.display_name,
            params.status,
            params.created_at,
            params.updated_at,
            params.payload_json,
          );
      } catch (error) {
        const isCustomerIdConflict = /customers\.customer_id/i.test(String(error?.message ?? ""));
        if (!isCustomerIdConflict) {
          throw error;
        }

        const result = database
          .prepare(`
            UPDATE customers
            SET
              customer_slug = ?,
              display_name = ?,
              status = ?,
              updated_at = ?,
              payload_json = ?
            WHERE customer_id = ?
          `)
          .run(
            params.customer_slug,
            params.display_name,
            params.status,
            params.updated_at,
            params.payload_json,
            params.customer_id,
          );
        if (Number(result.changes ?? 0) === 0) {
          throw error;
        }
      }
    });
  }

  return loadCustomer({
    serviceStorageRoot,
    customerSlug: safeCustomerSlug,
  });
}

export async function loadCustomer({
  serviceStorageRoot,
  customerId,
  customerSlug,
} = {}) {
  const safeCustomerId = String(customerId ?? "").trim();
  const safeCustomerSlug = sanitizeSlug(customerSlug ?? "");
  if (!safeCustomerId && !safeCustomerSlug) {
    return null;
  }

  if (isPostgresStorageEnabled()) {
    return loadCustomerFromPostgres({
      customerId: safeCustomerId,
      customerSlug: safeCustomerSlug,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const row = safeCustomerId
      ? database
          .prepare("SELECT payload_json FROM customers WHERE customer_id = ? LIMIT 1")
          .get(safeCustomerId)
      : database
          .prepare("SELECT payload_json FROM customers WHERE customer_slug = ? LIMIT 1")
          .get(safeCustomerSlug);
    return parsePayload(row?.payload_json, null);
  });
}

export async function listCustomers({
  serviceStorageRoot,
  status,
  limit = 100,
  offset = 0,
} = {}) {
  if (isPostgresStorageEnabled()) {
    return listCustomersFromPostgres({
      status,
      limit,
      offset,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const clauses = [];
    const values = [];
    if (status) {
      clauses.push("status = ?");
      values.push(String(status));
    }
    const statement = database.prepare(`
      SELECT payload_json
      FROM customers
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY customer_slug ASC
      LIMIT ?
      OFFSET ?
    `);

    return statement
      .all(...values, Number(limit), Number(offset))
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean);
  });
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePayload(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
