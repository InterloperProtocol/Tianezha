import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { buildConfig } from "payload";

const isAdmin = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

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
      ],
    },
  ],
  db: sqliteAdapter({
    client: {
      url: process.env.PAYLOAD_DATABASE_URL || "file:./.data/goonclaw-payload.db",
    },
  }),
  secret: process.env.PAYLOAD_SECRET || process.env.APP_SESSION_SECRET || "goonclaw-dev-payload-secret",
});
