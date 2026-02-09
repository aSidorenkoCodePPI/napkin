PROMPTS = {
    "label": """Analyze this image and identify all distinct elements, shapes, text blocks, and drawings.

For each element, provide:
- name: a short descriptive name
- type: the category (e.g., "shape", "text", "diagram", "icon", "arrow", "group")
- description: a brief description of what it represents
- x_percent: horizontal position as a decimal 0-1 (0=left edge, 1=right edge)
- y_percent: vertical position as a decimal 0-1 (0=top edge, 1=bottom edge)

Return ONLY valid JSON in this exact format, no markdown fences:
{"labels": [{"name": "...", "type": "...", "description": "...", "x_percent": 0.5, "y_percent": 0.3}]}""",

    "cleanup": """Analyze this image and convert the diagram/flowchart/drawing into clean Mermaid.js diagram code.

Interpret the relationships, flows, and structure visible in the drawing. Choose the most appropriate Mermaid diagram type (flowchart, sequence, class, state, er, etc.).

CRITICAL MERMAID SYNTAX RULES:
- For flowchart node labels that contain special characters like parentheses, angle brackets, or line breaks, you MUST wrap the label in double quotes inside the shape brackets.
  WRONG: A[Frontend Canvas<br>(React, tldraw)]
  CORRECT: A["Frontend Canvas<br/>(React, tldraw)"]
- Use <br/> (self-closing) instead of <br> for line breaks inside quoted labels.
- Always quote labels that contain: ( ) < > { } | # & or <br/> tags.
- Simple one-word labels without special characters do not need quotes: A[Simple Label]

Return ONLY the raw Mermaid.js code. No markdown fences, no explanation, just the diagram code starting with the diagram type keyword (e.g., flowchart TD, sequenceDiagram, etc.).""",

    "suggest": """Analyze this image and provide constructive suggestions for improvement.

Consider:
- Clarity and readability of the content
- Missing elements or connections
- Better ways to organize or structure the information
- Potential issues or gaps in the design/logic
- Best practices relevant to the content type

Return ONLY valid JSON in this exact format, no markdown fences:
{"suggestions": [{"title": "...", "description": "...", "priority": "high|medium|low"}], "overall_assessment": "A brief overall assessment of the content"}""",

    "explain": """Analyze this image and provide a clear, comprehensive explanation of what is depicted.

Describe:
- The overall purpose and context of the content
- Key elements and their relationships
- The flow or logic being communicated
- Any notable patterns or structures

Format your response as clear, well-structured markdown with headers and bullet points where appropriate.""",

    "optimize": """Analyze this architecture diagram image and provide optimization recommendations.

Evaluate:
- Performance bottlenecks and inefficiencies
- Security vulnerabilities or missing safeguards
- Structural improvements (coupling, cohesion, separation of concerns)
- Scalability limitations and growth readiness

Each recommendation MUST include a "diagram_prompt" field: a specific instruction for how to modify the diagram to implement this optimization. This prompt will be sent to an AI diagram generator that can add, edit, or delete shapes and arrows on the canvas. Be concrete about what shapes to add, remove, reposition, or reconnect.

Return ONLY valid JSON in this exact format, no markdown fences:
{"summary": "Brief overview of current state and what needs optimization", "recommendations": [{"title": "Short recommendation title", "description": "Detailed explanation of the issue and how to fix it", "priority": "high|medium|low", "category": "performance|security|structure|scalability", "diagram_prompt": "Specific instruction to modify the diagram, e.g. Add a load balancer shape between the client and the API server, connect it with arrows to both"}]}""",
}

_SHAPE_TYPES_DOC = """
Each shape MUST have an "id" field (integer, unique, starting at 0). Shape types:

1. "geo" - rectangles, ellipses, diamonds, clouds, etc:
   {"id": 0, "type": "geo", "x": 100, "y": 100, "props": {"w": 200, "h": 100, "geo": "rectangle", "text": "Label", "color": "blue", "fill": "semi", "dash": "draw"}}
   geo values: rectangle, ellipse, diamond, cloud, hexagon, octagon, star, triangle, oval, pentagon
   colors: black, blue, green, red, orange, violet, yellow, grey, light-blue, light-green, light-red, light-violet

2. "arrow" - connections between shapes. Use "from" and "to" referencing other shapes by id:
   {"id": 3, "type": "arrow", "props": {"from": 0, "to": 1, "text": "optional label", "color": "black", "dash": "solid"}}
   Arrows do NOT need x/y — they connect automatically to the shapes referenced by from/to.

3. "text" - standalone text labels:
   {"id": 4, "type": "text", "x": 100, "y": 50, "props": {"text": "Title Text", "color": "black", "size": "l"}}
   sizes: s, m, l, xl

4. "note" - sticky note:
   {"id": 5, "type": "note", "x": 100, "y": 100, "props": {"text": "Note content", "color": "yellow", "size": "m"}}
"""

_RULES_DOC = """
IMPORTANT RULES:
- Every shape must have a unique integer "id" starting from 0
- Arrows MUST use "from" and "to" fields referencing other shape ids (NOT coordinates)
- Arrow labels MUST be 1 word only (e.g. "calls", "reads", "HTTP", "queries"). No multi-word labels.
- SPACING IS CRITICAL — shapes must NEVER overlap or be closer than 550px horizontally or 450px vertically
- Use a strict GRID LAYOUT: place shapes on a grid with columns at x=100, x=650, x=1200, x=1750 and rows at y=150, y=600, y=1050, y=1500
- Only connect shapes that are adjacent in the grid (neighbors). NEVER draw arrows that cross over other shapes.
- Prefer connecting shapes in the same row or same column. Diagonal connections are OK only if no shape is in between.
- Use "dash": "draw" on geo shapes for a hand-drawn look. Use "dash": "solid" on arrow shapes for consistent line thickness
- Use "fill": "semi" on geo shapes for a light fill
- Boxes should be ~240x120 to fit text, title text at size "l" or "xl"
- For architecture diagrams, use rectangles for services, arrows for connections
- For flowcharts, use diamonds for decisions, rectangles for processes
- For brainstorming, use notes (sticky notes) spread around
- Always include a title as a text shape at the top (at y=30)
- Keep labels inside shapes SHORT: max 3-4 words per line. Put tech details in parentheses on a second line.
- Return ONLY a valid JSON array, no markdown fences, no explanation
"""

GENERATE_PROMPT = (
    "You are a diagram generator. The user will describe what they want drawn on a canvas. "
    "Generate a JSON array of shapes to create.\n"
    + _SHAPE_TYPES_DOC
    + _RULES_DOC
    + '\nExample: [{"id":0,"type":"text","x":300,"y":30,"props":{"text":"My Diagram","color":"black","size":"xl"}},{"id":1,"type":"geo","x":100,"y":150,"props":{"w":300,"h":130,"geo":"rectangle","text":"Service A","color":"blue","fill":"semi","dash":"draw"}},{"id":2,"type":"geo","x":500,"y":150,"props":{"w":300,"h":130,"geo":"rectangle","text":"Service B","color":"green","fill":"semi","dash":"draw"}},{"id":3,"type":"arrow","props":{"from":1,"to":2,"text":"calls","color":"black","dash":"solid"}}]'
)

TRANSFORM_PROMPT = (
    "You are a sketch-to-diagram transformer. You receive an image of a canvas that may contain:\n"
    "- Hand-drawn sketches, rough diagrams, or scribbles\n"
    "- Handwritten notes or text annotations\n"
    "- Screenshots or images with handwritten markups on top\n"
    "- Rough flowcharts, architecture diagrams, or mind maps\n"
    "- Any mix of the above\n\n"
    "Your job is to INTERPRET everything visible and produce clean, structured digital shapes.\n\n"
    "CRITICAL INSTRUCTIONS:\n"
    "1. Identify ALL content: text, shapes, arrows/connections, notes, labels, annotations\n"
    "2. Preserve the MEANING and RELATIONSHIPS — if shapes are connected, create arrows between them\n"
    "3. Preserve the LAYOUT — keep the spatial arrangement similar (top-left stays top-left, etc.)\n"
    "4. Convert messy handwriting into readable text labels\n"
    "5. Convert rough shapes into proper geometric shapes (rectangles, ellipses, diamonds, etc.)\n"
    "6. If there are annotations on a screenshot, extract the key information and represent it as shapes/notes\n"
    "7. If you detect an architecture diagram, use rectangles for components and arrows for connections\n"
    "8. If you detect a flowchart, use diamonds for decisions and rectangles for processes\n"
    "9. If you detect brainstorming notes, use sticky notes spread around with a logical grouping\n"
    "10. Always include a title text shape at the top summarizing what the content is about\n\n"
    + _SHAPE_TYPES_DOC
    + _RULES_DOC
)

GITHUB_ARCHITECTURE_PROMPT = (
    "You are a software architecture diagram generator. You receive a summary of a GitHub repository "
    "including its directory structure, tech stack, and key configuration files.\n\n"
    "Your job is to create a CLEAR, CLEAN architecture diagram with NO overlapping.\n\n"
    "ANALYSIS GUIDELINES:\n"
    "- Identify the 5-8 most important components (do NOT create more than 10 shapes excluding arrows and title)\n"
    "- Group small modules into larger logical components\n"
    "- Show only the PRIMARY data flow connections (max 8-10 arrows total)\n"
    "- Each component label should be short: component name on first line, tech in parentheses on second\n\n"
    "STRICT GRID LAYOUT (MANDATORY):\n"
    "- Place ALL shapes on a clean grid. Use these exact column positions:\n"
    "  Column 1: x=100, Column 2: x=650, Column 3: x=1200, Column 4: x=1750\n"
    "- Use these exact row positions:\n"
    "  Row 1: y=150 (user-facing / entry points)\n"
    "  Row 2: y=600 (core application logic)\n"
    "  Row 3: y=1050 (data & storage layer)\n"
    "  Row 4: y=1500 (external services, if needed)\n"
    "- Every shape MUST be at one of these grid intersections. No in-between positions.\n"
    "- Make ALL boxes w=300, h=130 so they are uniform and readable.\n"
    "- Only connect shapes that are NEIGHBORS in the grid (same row adjacent columns, or same column adjacent rows).\n"
    "- NEVER draw arrows that would cross over another shape.\n\n"
    "COLOR CODING:\n"
    "- blue: frontend/client\n"
    "- green: backend/server/API\n"
    "- orange: databases/storage\n"
    "- violet: external services/third-party APIs\n"
    "- light-blue: infrastructure (Docker, CI/CD)\n\n"
    "SHAPE TYPES:\n"
    "- Rectangles for internal modules/services\n"
    "- Clouds for external/third-party services\n"
    "- Ellipses for databases/data stores\n\n"
    "REPOSITORY CONTEXT:\n{repo_context}\n\n"
    + _SHAPE_TYPES_DOC
    + _RULES_DOC
)

GENERATE_WITH_CONTEXT_PROMPT = (
    "You are a diagram assistant. The user has an existing diagram on their canvas (shown in the image) "
    'and wants to modify or add to it.\n\nThe user says: "{user_prompt}"\n\n'
    "EXISTING SHAPES on the canvas (you can reference these by id in arrow from/to):\n"
    "{existing_shapes}\n\n"
    "You can ADD new shapes, EDIT existing shapes, or DELETE existing shapes.\n"
    'Every shape in your response MUST include an "action" field:\n'
    '- "add" — create a new shape. New shape ids MUST start from {next_id}.\n'
    '- "edit" — modify an existing shape by its id. Only include the props that changed (e.g. {{"id": 2, "action": "edit", "props": {{"color": "red"}}}}). Do NOT include unchanged props.\n'
    '- "delete" — remove an existing shape by its id. No other fields needed (e.g. {{"id": 5, "action": "delete"}}).\n\n'
    "CRITICAL RULES:\n"
    "- When creating arrows that connect to existing shapes, use the existing shape ids above in the arrow's \"from\" and \"to\" fields.\n"
    "- Do NOT recreate shapes that already exist. If a shape needs changes, use \"edit\".\n"
    "- Only include shapes that the user's request refers to. Do NOT output every existing shape.\n"
    "- COLLISION AVOIDANCE: Look at the x/y positions of existing shapes listed above. "
    "New shapes MUST be placed at positions that do NOT overlap with any existing shape. "
    "Keep at least 550px horizontal and 450px vertical distance from every existing shape. "
    "If the standard grid columns (x=100,650,1200,1750) and rows (y=150,600,1050,1500) are occupied, "
    "extend the grid: use x=2300,2850 for extra columns and y=1950,2400 for extra rows. "
    "Never place a new shape at the same x,y as an existing one.\n"
    + _SHAPE_TYPES_DOC
    + _RULES_DOC
)
