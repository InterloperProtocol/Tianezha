import { mkdirSync } from "node:fs";
import path from "node:path";

import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { buildConfig } from "payload";

const isAdmin = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

function resolvePayloadDatabaseUrl() {
  const defaultDatabaseUrl =
    process.env.NODE_ENV === "production"
      ? "file:/tmp/tianshi-payload.db"
      : "file:./.data/tianshi-payload.db";
  const configuredUrl = process.env.PAYLOAD_DATABASE_URL || defaultDatabaseUrl;

  if (!configuredUrl.startsWith("file:")) {
    return configuredUrl;
  }

  const rawPath = configuredUrl.slice("file:".length) || "./.data/tianshi-payload.db";
  const absolutePath = path.resolve(process.cwd(), rawPath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });

  return `file:${absolutePath.replace(/\\/g, "/")}`;
}

const payloadDatabaseUrl = resolvePayloadDatabaseUrl();
const payloadSecret =
  process.env.PAYLOAD_SECRET ||
  process.env.APP_SESSION_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "tianshi-dev-payload-secret");

if (!payloadSecret) {
  throw new Error(
    "PAYLOAD_SECRET or APP_SESSION_SECRET must be configured in production",
  );
}

export default buildConfig({
  admin: {
    user: "admins",
  },
  collections: [
    {
      slug: "admins",
      auth: {
        loginWithUsername: {
          allowEmailLogin: false,
          requireUsername: true,
        },
      },
      access: {
        admin: isAdmin,
        create: isAdmin,
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        useAsTitle: "username",
      },
      fields: [
        {
          name: "username",
          type: "text",
          required: true,
          unique: true,
          index: true,
        },
        {
          name: "displayName",
          type: "text",
        },
      ],
    },
    {
      slug: "streamer-controls",
      access: {
        admin: isAdmin,
        create: isAdmin,
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        useAsTitle: "guestId",
      },
      fields: [
        {
          name: "guestId",
          type: "text",
          required: true,
          unique: true,
          index: true,
        },
        {
          name: "slug",
          type: "text",
        },
        {
          name: "isDisabled",
          type: "checkbox",
          defaultValue: false,
        },
        {
          name: "disabledAt",
          type: "date",
          admin: {
            date: {
              pickerAppearance: "dayAndTime",
            },
          },
        },
        {
          name: "disabledBy",
          type: "text",
        },
        {
          name: "reason",
          type: "textarea",
        },
        {
          name: "hiddenAt",
          type: "date",
          admin: {
            date: {
              pickerAppearance: "dayAndTime",
            },
          },
        },
        {
          name: "hiddenBy",
          type: "text",
        },
        {
          name: "hiddenReason",
          type: "textarea",
        },
      ],
    },
  ],
  db: sqliteAdapter({
    client: {
      url: payloadDatabaseUrl,
    },
  }),
  secret: payloadSecret,
});
