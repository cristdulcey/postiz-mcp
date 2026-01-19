#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { FormData } from "formdata-node";
import { fileFromPath } from "formdata-node/file-from-path";

const API_KEY = process.env.POSTIZ_API_KEY;
const API_URL = process.env.POSTIZ_API_URL || "https://postiz.com";

if (!API_KEY) {
  console.error("Error: POSTIZ_API_KEY environment variable is required");
  process.exit(1);
}

const server = new Server(
  {
    name: "postiz-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

async function postizRequest(endpoint, method = "GET", body = null) {
  const url = `${API_URL}/api/public/v1${endpoint}`;
  const options = {
    method,
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Postiz API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "postiz_upload_media",
        description: "Upload an image file to Postiz. Returns the media ID to use when scheduling posts.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Absolute path to the image file to upload",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "postiz_schedule_post",
        description: "Schedule a post to one or multiple social media accounts. Use postiz_list_accounts to get integration IDs.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The text content of the post",
            },
            integrationIds: {
              type: "array",
              description: "Array of integration IDs from connected accounts (get them from postiz_list_accounts)",
              items: {
                type: "string",
              },
            },
            scheduledDate: {
              type: "string",
              description: "ISO 8601 date-time string for when to publish (e.g., '2026-01-14T15:00:00Z')",
            },
            media: {
              type: "array",
              description: "Optional array of media objects with id and path from postiz_upload_media",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  path: { type: "string" },
                },
                required: ["id", "path"],
              },
            },
            instagramPostType: {
              type: "string",
              enum: ["post", "story"],
              description: "For Instagram: 'post' for feed post (permanent) or 'story' for 24-hour story. Default is 'post'.",
            },
          },
          required: ["content", "integrationIds", "scheduledDate"],
        },
      },
      {
        name: "postiz_list_accounts",
        description: "List all connected social media accounts",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "postiz_get_posts",
        description: "Get scheduled or published posts",
        inputSchema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description: "Start date in ISO 8601 format (e.g., '2026-01-15T00:00:00.000Z')",
            },
            endDate: {
              type: "string",
              description: "End date in ISO 8601 format (e.g., '2026-01-15T23:59:59.000Z')",
            },
          },
          required: ["startDate", "endDate"],
        },
      },
      {
        name: "postiz_delete_post",
        description: "Delete a scheduled or published post by ID",
        inputSchema: {
          type: "object",
          properties: {
            postId: {
              type: "string",
              description: "The ID of the post to delete",
            },
          },
          required: ["postId"],
        },
      },
      {
        name: "postiz_delete_posts_by_date",
        description: "Delete all posts scheduled for a specific date range",
        inputSchema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description: "Start date in ISO 8601 format (e.g., '2026-01-15T00:00:00.000Z')",
            },
            endDate: {
              type: "string",
              description: "End date in ISO 8601 format (e.g., '2026-01-15T23:59:59.000Z')",
            },
          },
          required: ["startDate", "endDate"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "postiz_upload_media") {
      const formData = new FormData();
      const file = await fileFromPath(args.filePath);
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/public/v1/upload`, {
        method: "POST",
        headers: {
          Authorization: API_KEY,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${error}`);
      }

      const result = await response.json();

      return {
        content: [
          {
            type: "text",
            text: `File uploaded successfully!\n\nMedia ID: ${result.id}\nPath: ${result.path}\n\nUse this media ID in postiz_schedule_post`,
          },
        ],
      };
    }

    if (name === "postiz_schedule_post") {
      // First, get integrations to map IDs to platform types
      const integrations = await postizRequest("/integrations");
      const platformMap = {};
      for (const integration of integrations) {
        platformMap[integration.id] = integration.identifier;
      }

      // Get platform-specific settings
      const instagramType = args.instagramPostType || "post";
      const getPlatformSettings = (platformType) => {
        switch (platformType) {
          case "x":
            return { __type: "x", who_can_reply_post: "everyone", community: "" };
          case "linkedin":
            return { __type: "linkedin" };
          case "instagram":
            return { __type: "instagram", post_type: instagramType, collaborators: [] };
          default:
            return { __type: platformType };
        }
      };

      // Create a post entry for each integration
      const posts = args.integrationIds.map((integrationId) => {
        const platformType = platformMap[integrationId] || "x";
        return {
          integration: {
            id: integrationId,
          },
          value: [
            {
              content: args.content,
              image: args.media || [],
            },
          ],
          settings: getPlatformSettings(platformType),
        };
      });

      const result = await postizRequest("/posts", "POST", {
        type: "schedule",
        date: args.scheduledDate,
        shortLink: false,
        tags: [],
        posts: posts,
      });

      return {
        content: [
          {
            type: "text",
            text: `Post scheduled successfully!\n\nIntegrations: ${args.integrationIds.join(", ")}\nScheduled for: ${args.scheduledDate}\n\nResponse: ${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }

    if (name === "postiz_list_accounts") {
      const result = await postizRequest("/integrations");

      return {
        content: [
          {
            type: "text",
            text: `Connected accounts:\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }

    if (name === "postiz_get_posts") {
      const endpoint = `/posts?startDate=${encodeURIComponent(args.startDate)}&endDate=${encodeURIComponent(args.endDate)}`;
      const result = await postizRequest(endpoint);

      // Format posts for better readability
      const postsInfo = result.posts?.map((post) => ({
        id: post.id,
        platform: post.integration?.providerIdentifier,
        publishDate: post.publishDate,
        state: post.state,
        contentPreview: post.content?.substring(0, 50) + "...",
      })) || [];

      return {
        content: [
          {
            type: "text",
            text: `Found ${postsInfo.length} posts:\n\n${JSON.stringify(postsInfo, null, 2)}`,
          },
        ],
      };
    }

    if (name === "postiz_delete_post") {
      const result = await postizRequest(`/posts/${args.postId}`, "DELETE");

      return {
        content: [
          {
            type: "text",
            text: `Post deleted successfully!\n\nPost ID: ${args.postId}`,
          },
        ],
      };
    }

    if (name === "postiz_delete_posts_by_date") {
      // First get all posts in the date range
      const endpoint = `/posts?startDate=${encodeURIComponent(args.startDate)}&endDate=${encodeURIComponent(args.endDate)}`;
      const result = await postizRequest(endpoint);

      const posts = result.posts || [];
      if (posts.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No posts found in the specified date range.",
            },
          ],
        };
      }

      // Delete each post
      const deletedPosts = [];
      for (const post of posts) {
        await postizRequest(`/posts/${post.id}`, "DELETE");
        deletedPosts.push({
          id: post.id,
          platform: post.integration?.providerIdentifier,
        });
      }

      return {
        content: [
          {
            type: "text",
            text: `Deleted ${deletedPosts.length} posts:\n\n${JSON.stringify(deletedPosts, null, 2)}`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Postiz MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
