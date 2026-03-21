import { mkdirSync } from "node:fs";
import path from "node:path";

import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { buildConfig } from "payload";

const isAdmin = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

function resolvePayloadDatabaseUrl() {
  const configuredUrl =
    process.env.PAYLOAD_DATABASE_URL || "file:./.data/goonclaw-payload.db";

  if (!configuredUrl.startsWith("file:")) {
    return configuredUrl;
  }

  const rawPath = configuredUrl.slice("file:".length) || "./.data/goonclaw-payload.db";
  const absolutePath = path.resolve(process.cwd(), rawPath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });

  return `file:${absolutePath.replace(/\\/g, "/")}`;
}

const payloadDatabaseUrl = resolvePayloadDatabaseUrl();

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
  secret: process.env.PAYLOAD_SECRET || process.env.APP_SESSION_SECRET || "goonclaw-dev-payload-secret",
});
