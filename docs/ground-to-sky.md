# Ground-to-sky experiment

Branch: `experiment/ground-to-sky`.
Preview: https://yukagecho-ground-to-sky.taishi-k0903.workers.dev
Cloudflare version: `a8fe20f1-f74f-499b-a5de-af856dc38313`.

The experiment adds a grounded foothill town, Sakura Springs, and Cloudview Terrace.
Two continuous red stair bridges connect the town to the original four sky islands.
The ground starts 28 world units below Yuakari Street.
The camera opens at street level with the ascent and sky islands visible beyond the rooftops.
English headings retain smaller Japanese place names.
The journal and minimap cover all seven discoveries.

The existing procedural art style remains intentional.
The reference images guide the layered town, red bridges, warm windows, cherry trees, steam, and upward journey.
This is not a photorealistic reconstruction of those references.
Interior rooms and free roaming in the distant forests are outside this experiment.

Validation:
- TypeScript production build, ESLint, formatting and three surface/collision tests passed.
- Desktop and mobile interaction tests passed locally and on the public experiment URL.
- Keyboard traversal discovered all seven places, climbed every bridge, and returned to the foothill town.
- The complete round trip passed in approximately 4.5 minutes.
- Desktop, mobile, ascent and completed journal screenshots were visually inspected.
- The camera angle was lowered to keep the upper islands in view.
- Ground edges were extended out of view, and cloud shelves and woodland were added around the ascent.

The original production Worker is unchanged.
