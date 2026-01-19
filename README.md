# Postiz MCP Server

An MCP (Model Context Protocol) server that integrates with [Postiz](https://postiz.com), the open-source social media scheduling platform. This server enables AI assistants like Claude to manage social media posts programmatically.

## Features

- **Upload media** - Upload images to use in social media posts
- **Schedule posts** - Schedule content to multiple platforms simultaneously
- **Multi-platform support** - X/Twitter, LinkedIn, Instagram (feed posts and stories), and more
- **Manage posts** - List, query, and delete scheduled or published posts
- **Batch operations** - Delete multiple posts by date range

## Installation

```bash
npm install mcp-postiz-server
```

Or clone the repository:

```bash
git clone https://github.com/your-username/mcp-postiz.git
cd mcp-postiz
npm install
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTIZ_API_KEY` | Yes | Your Postiz API key |
| `POSTIZ_API_URL` | No | Custom Postiz API URL (defaults to `https://postiz.com`) |

### Getting Your API Key

1. Log in to your Postiz account
2. Navigate to Settings > API Keys
3. Generate a new API key
4. Copy the key and set it as `POSTIZ_API_KEY`

## Usage

### Running the Server

```bash
POSTIZ_API_KEY=your_api_key node index.js
```

Or as an installed command:

```bash
POSTIZ_API_KEY=your_api_key mcp-postiz
```

### Claude Desktop Configuration

Add to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "postiz": {
      "command": "node",
      "args": ["/path/to/mcp-postiz/index.js"],
      "env": {
        "POSTIZ_API_KEY": "your_api_key_here",
        "POSTIZ_API_URL": "your_api_url_here"
      }
    }
  }
}
```

## Available Tools

### `postiz_list_accounts`

List all connected social media accounts. Returns integration IDs needed for scheduling posts.

**Parameters:** None

**Example Response:**
```json
[
  {
    "id": "abc123",
    "identifier": "x",
    "name": "My Twitter Account"
  },
  {
    "id": "def456",
    "identifier": "instagram",
    "name": "My Instagram"
  }
]
```

### `postiz_upload_media`

Upload an image file to Postiz for use in posts.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | Yes | Absolute path to the image file |

**Returns:** Media ID and path to use when scheduling posts

### `postiz_schedule_post`

Schedule a post to one or multiple social media accounts.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | The text content of the post |
| `integrationIds` | string[] | Yes | Array of integration IDs from `postiz_list_accounts` |
| `scheduledDate` | string | Yes | ISO 8601 date-time (e.g., `2026-01-15T15:00:00Z`) |
| `media` | object[] | No | Array of media objects with `id` and `path` from `postiz_upload_media` |
| `instagramPostType` | string | No | For Instagram: `post` (feed) or `story` (24-hour). Default: `post` |

**Platform-Specific Settings:**
- **X/Twitter**: Configures reply settings (everyone can reply)
- **LinkedIn**: Standard post configuration
- **Instagram**: Supports feed posts and stories

### `postiz_get_posts`

Get scheduled or published posts within a date range.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | Start date in ISO 8601 format |
| `endDate` | string | Yes | End date in ISO 8601 format |

**Example Response:**
```json
[
  {
    "id": "post123",
    "platform": "x",
    "publishDate": "2026-01-15T15:00:00Z",
    "state": "scheduled",
    "contentPreview": "Check out our new feature..."
  }
]
```

### `postiz_delete_post`

Delete a specific scheduled or published post.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `postId` | string | Yes | The ID of the post to delete |

### `postiz_delete_posts_by_date`

Delete all posts within a specific date range.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | Start date in ISO 8601 format |
| `endDate` | string | Yes | End date in ISO 8601 format |

## Example Workflows

### Schedule a Text Post

1. List accounts to get integration IDs:
   ```
   Use postiz_list_accounts
   ```

2. Schedule the post:
   ```
   Use postiz_schedule_post with:
   - content: "Hello from Claude!"
   - integrationIds: ["abc123"]
   - scheduledDate: "2026-01-15T15:00:00Z"
   ```

### Schedule a Post with Image

1. Upload the image:
   ```
   Use postiz_upload_media with:
   - filePath: "/path/to/image.jpg"
   ```

2. Schedule with the uploaded media:
   ```
   Use postiz_schedule_post with:
   - content: "Check out this image!"
   - integrationIds: ["abc123", "def456"]
   - scheduledDate: "2026-01-15T15:00:00Z"
   - media: [{"id": "media_id", "path": "media_path"}]
   ```

### Post to Instagram Stories

```
Use postiz_schedule_post with:
- content: "Quick update!"
- integrationIds: ["instagram_id"]
- scheduledDate: "2026-01-15T15:00:00Z"
- instagramPostType: "story"
```

## API Reference

The server communicates with the Postiz public API:

- **Base URL**: `https://postiz.com/api/public/v1`
- **Authentication**: API key in `Authorization` header
- **Endpoints used**:
  - `POST /upload` - Upload media files
  - `GET /integrations` - List connected accounts
  - `POST /posts` - Create/schedule posts
  - `GET /posts` - Query posts
  - `DELETE /posts/{id}` - Delete posts

## Requirements

- Node.js 18+
- Postiz account with API access
- Connected social media accounts in Postiz

## License

GNU GENERAL PUBLIC LICENSE [LICENSE](LICENSE)