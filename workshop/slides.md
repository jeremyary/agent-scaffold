---
theme: default
title: "Converting from Agile to AI-Native Development"
info: |
  Internal workshop for Red Hat engineering teams.
  Presenter: Jeremy Ary
author: Jeremy Ary
keywords: ai-native,sdd,agile,claude-code
exportFilename: ai-native-workshop
download: true
highlighter: shiki
drawings:
  persist: false
transition: slide-left
mdc: true
---

<!-- COVER SLIDE -->

<div class="h-full flex flex-col justify-center items-center text-center" style="background: #151515; color: #fff; margin: -48px; padding: 48px;">
  <div style="width: 120px; height: 4px; background: #EE0000; margin-bottom: 2em; border-radius: 2px;"></div>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 2.8em; line-height: 1.1; color: #fff; margin: 0;">
    From Agile to AI-Native
  </h1>
  <p style="font-family: 'Red Hat Text', sans-serif; font-size: 1.2em; color: #A3A3A3; margin-top: 1em;">
    A problem in both process & perspective.
  </p>
  <p style="font-family: 'Red Hat Mono', monospace; font-size: 0.85em; color: #6A6E73; margin-top: 0.5em;">
    
  </p>
  <div style="width: 120px; height: 4px; background: #EE0000; margin-top: 2em; border-radius: 2px;"></div>
</div>


---
layout: section
---

<div style="background: #151515; color: #fff; margin: -48px; padding: 48px; height: calc(100% + 96px); display: flex; flex-direction: column; justify-content: center;">
  <p style="font-family: 'Red Hat Mono', monospace; color: #EE0000; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5em;">Act 1</p>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 3em; color: #fff; margin: 0;">Questions<br/>& Concerns</h1>
  <div style="width: 80px; height: 4px; background: #EE0000; margin-top: 0.8em; border-radius: 2px;"></div>
  <p style="color: #A3A3A3; margin-top: 1em; font-size: 1.1em;"></p>
</div>
---

# What happens when the emphasis shifts?

<div class="mt-4" style="font-size: 1.15em; max-width: 80%;">

For my whole career, our entire methodology assumed one thing:
<br/><br/>
<p class="mt-4" style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.4em; color: #EE0000;">
  Problem solving is the hard part.
</p>
<br/>
Sprints, story points, velocity, stand-ups -- all designed around the assumption that 'coding' is a main factor affecting capacities and timelines.
<br/><br/><br/>
What happens when it isn't? 

How do we communicate about it?

</div>
---

# Where do I watch for technical debt?

<div class="flex justify-center mt-4">
<svg viewBox="0 0 1000 560" style="width: 80%; display: block;">
  <!-- Axes -->
  <line x1="100" y1="460" x2="900" y2="460" stroke="#A3A3A3" stroke-width="1.5"/>
  <line x1="100" y1="460" x2="100" y2="40" stroke="#A3A3A3" stroke-width="1.5"/>

  <!-- Y-axis label -->
  <text x="60" y="250" fill="#A3A3A3" font-size="7" transform="rotate(-90, 60, 250)" text-anchor="middle">Output</text>

  <!-- X-axis label -->
  <text x="500" y="510" fill="#A3A3A3" font-size="7" text-anchor="middle">AI Tool Adoption</text>

  <!-- Code Volume curve (steep rise) -->
  <path d="M 130 430 Q 300 400 480 280 Q 650 140 860 80" fill="none" stroke="#EE0000" stroke-width="3" stroke-linecap="round"/>

  <!-- Deployable Value curve (flattening) -->
  <path d="M 130 430 Q 300 385 480 340 Q 650 310 860 295" fill="none" stroke="#0066CC" stroke-width="3" stroke-linecap="round"/>

  <!-- Gap annotation -->
  <line x1="700" y1="140" x2="700" y2="305" stroke="#F5921B" stroke-width="2" stroke-dasharray="6,4"/>
  <text x="714" y="225" fill="#F5921B" font-size="7" font-weight="700">Review Gap</text>

  <!-- Legend -->
  <rect x="250" y="18" width="10" height="3" rx="1" fill="#EE0000"/>
  <text x="265" y="21" fill="#C7C7C7" font-size="6">Code Velocity</text>
  <rect x="600" y="18" width="10" height="3" rx="1" fill="#0066CC"/>
  <text x="615" y="21" fill="#C7C7C7" font-size="6">Deliverable Value</text>

  <!-- Axis ticks -->
  <text x="130" y="485" fill="#A3A3A3" font-size="6" text-anchor="middle">Low</text>
  <text x="860" y="485" fill="#A3A3A3" font-size="6" text-anchor="middle">High</text>
</svg>
</div>

<p class="text-center mt-2" style="color: #6A6E73; font-size: 0.9em;">We have to change our perspective of "review" & we have to own it.<br/>Sprints would fall apart because they're designed to end-load "review".</p>
---

# Is estimation still possible? Important?

<div class="grid grid-cols-2 gap-8 mt-6">
<div>

### Before AI

- 8-point story = ~1 week of work
- Stand-ups surface blockers
- Velocity charts track capacity
- Sprint commitments are meaningful

</div>
<div>

### With AI

- 8-point story takes... 2 hours? 2 days?
- Blockers resolve in 30 seconds
- Velocity charts become meaningless
- Sprint commitments are probably theater

</div>
</div>

<div class="mt-8 callout" style="border-left: 4px solid #EE0000; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0;">

Story points estimate <strong>coding effort</strong>. When coding effort drops 10x but review effort grows, does the system break?

</div>
---

# Is vibe coding a meme or legitimate concern?

<div class="grid grid-cols-3 gap-4 mt-6">

<div class="card" style="background: #292929; border: 1px solid #4D4D4D; border-radius: 8px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #3D7317; margin-bottom: 0.5em;">Defining it</div>
  <p style="font-size: 0.9em;">Iterative, ad-hoc prompting where the output "feels" correct. No spec, no plan, no verification criteria.</p>
</div>

<div class="card" style="background: #292929; border: 1px solid #4D4D4D; border-radius: 8px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #0066CC; margin-bottom: 0.5em;">Where It's Good</div>
  <p style="font-size: 0.9em;">Prototypes, one-off scripts, personal tools, hackathons. Anywhere throwaway code is acceptable.</p>
</div>

<div class="card" style="background: #292929; border: 1px solid #4D4D4D; border-radius: 8px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #B1380B; margin-bottom: 0.5em;">Where It Fails</div>
  <p style="font-size: 0.9em;">Teams, production systems, anything with history. Bus factor of 1, no source of truth, context drift between sessions.</p>
</div>

</div>

<div class="mt-6" style="text-align: center; color: #6A6E73; font-size: 0.95em;">

Most people start here. That's fine, but how do we grow from here?

</div>
---

# Will we lose our ability to understand?

<div class="mt-6 text-center">
  <div style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.6em; color: #4D4D4D; line-height: 1.3;">
    The act of typing code forces me to build<br>a <span style="color: #EE0000;">mental model</span> of systems.
  </div>
</div>

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="card" style="border: 2px solid #4D4D4D; border-radius: 8px; padding: 1.5em; text-align: center;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #3D7317; font-size: 1.1em;">Traditional Loop</div>
  <p style="font-size: 0.9em; margin-top: 0.5em;">Read code &rarr; reason about state &rarr; write code &rarr; debug &rarr; <strong>understand</strong></p>
</div>

<div class="card" style="border: 2px solid #B1380B; border-radius: 8px; padding: 1.5em; text-align: center;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #B1380B; font-size: 1.1em;">Insufficient Agentic Loop</div>
  <p style="font-size: 0.9em; margin-top: 0.5em;">Describe intent &rarr; agent generates &rarr; skim output &rarr; ship &rarr; <strong>???</strong></p>
</div>

</div>

<div class="mt-6 callout" style="border-left: 4px solid #EE0000; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0;">

Engineers risk becoming **"passengers" in their own codebase** -- capable of generating features but incapable of explaining their implementation or recognizing / debugging complex failures.

</div>
---
layout: section
---

<div style="background: #151515; color: #fff; margin: -48px; padding: 48px; height: calc(100% + 96px); display: flex; flex-direction: column; justify-content: center;">
  <p style="font-family: 'Red Hat Mono', monospace; color: #EE0000; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5em;">Act 2</p>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 3em; color: #fff; margin: 0;">My 'AHA!' Moment</h1>
  <div style="width: 80px; height: 4px; background: #EE0000; margin-top: 0.8em; border-radius: 2px;"></div>
  <p style="color: #A3A3A3; margin-top: 1em; font-size: 1.1em;">Here be math dragons</p>
</div>
---

# Autonomous iteration becomes a numbers game.

<div class="mt-4" style="font-size: 1.1em;">

If each autonomous step has **95% reliability**:

</div>

<div class="grid grid-cols-4 gap-6 mt-6 text-center">

<div>
  <div class="big-number" style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 3em; color: #2939eb;">95%</div>
  <div style="font-size: 0.9em; color: #6A6E73; margin-top: 0.3em;">1 step</div>
  <div style="font-size: 0.8em; color: #A3A3A3;">0.95<sup>1</sup></div>
</div>

<div>
  <div class="big-number" style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 3em; color: #3D7317;">77%</div>
  <div style="font-size: 0.9em; color: #6A6E73; margin-top: 0.3em;">5 steps</div>
  <div style="font-size: 0.8em; color: #A3A3A3;">0.95<sup>5</sup></div>
</div>

<div>
  <div class="big-number" style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 3em; color: #F5921B;">54%</div>
  <div style="font-size: 0.9em; color: #6A6E73; margin-top: 0.3em;">12 steps</div>
  <div style="font-size: 0.8em; color: #A3A3A3;">0.95<sup>12</sup></div>
</div>

<div>
  <div class="big-number" style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 3em; color: #EE0000;">36%</div>
  <div style="font-size: 0.9em; color: #6A6E73; margin-top: 0.3em;">20 steps</div>
  <div style="font-size: 0.8em; color: #A3A3A3;">0.95<sup>20</sup></div>
</div>

</div>

<div class="mt-8 callout" style="border-left: 4px solid #EE0000; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0;">

"Migrate the entire frontend to React" will fail. Every step building on an error makes recovery harder.

</div>
---

# Checkpoints are critical!

<div class="flex justify-center mt-4">
<svg viewBox="0 0 1000 600" style="width: 85%; display: block;">
  <!-- Axes -->
  <line x1="120" y1="480" x2="900" y2="480" stroke="#A3A3A3" stroke-width="1.5"/>
  <line x1="120" y1="480" x2="120" y2="60" stroke="#A3A3A3" stroke-width="1.5"/>

  <!-- Y-axis gridlines -->
  <line x1="120" y1="396" x2="900" y2="396" stroke="#4D4D4D" stroke-width="0.5"/>
  <line x1="120" y1="312" x2="900" y2="312" stroke="#4D4D4D" stroke-width="0.5"/>
  <line x1="120" y1="228" x2="900" y2="228" stroke="#4D4D4D" stroke-width="0.5"/>
  <line x1="120" y1="144" x2="900" y2="144" stroke="#4D4D4D" stroke-width="0.5"/>
  <line x1="120" y1="60" x2="900" y2="60" stroke="#4D4D4D" stroke-width="0.5"/>

  <!-- Y-axis labels -->
  <text x="108" y="484" fill="#A3A3A3" font-size="6" text-anchor="end">0%</text>
  <text x="108" y="400" fill="#A3A3A3" font-size="6" text-anchor="end">20%</text>
  <text x="108" y="316" fill="#A3A3A3" font-size="6" text-anchor="end">40%</text>
  <text x="108" y="232" fill="#A3A3A3" font-size="6" text-anchor="end">60%</text>
  <text x="108" y="148" fill="#A3A3A3" font-size="6" text-anchor="end">80%</text>
  <text x="108" y="64" fill="#A3A3A3" font-size="6" text-anchor="end">100%</text>

  <!-- Axis titles -->
  <text x="510" y="540" fill="#A3A3A3" font-size="7" text-anchor="middle">Autonomous Steps</text>
  <text x="50" y="270" fill="#A3A3A3" font-size="7" transform="rotate(-90, 50, 270)" text-anchor="middle">Success Rate</text>

  <!-- X-axis tick labels -->
  <text x="170" y="505" fill="#A3A3A3" font-size="6" text-anchor="middle">1</text>
  <text x="280" y="505" fill="#A3A3A3" font-size="6" text-anchor="middle">3</text>
  <text x="390" y="505" fill="#A3A3A3" font-size="6" text-anchor="middle">5</text>
  <text x="500" y="505" fill="#A3A3A3" font-size="6" text-anchor="middle">7</text>
  <text x="650" y="505" fill="#A3A3A3" font-size="6" text-anchor="middle">12</text>
  <text x="860" y="505" fill="#A3A3A3" font-size="6" text-anchor="middle">20</text>

  <!-- Without checkpoints (exponential decay): 95%, 85.7%, 77.4%, 69.8%, 54.0%, 35.8% -->
  <path d="M 170 81 L 280 120 L 390 155 L 500 187 L 650 253 L 860 330"
        fill="none" stroke="#EE0000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- With checkpoints (sawtooth 95%->85%->95%->85%->95%->90%) -->
  <path d="M 170 81 L 280 117 L 390 81 L 500 117 L 650 81 L 860 102"
        fill="none" stroke="#0066CC" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Checkpoint markers (at each reset peak) -->
  <circle cx="390" cy="81" r="5" fill="#0066CC" stroke="#292929" stroke-width="2"/>
  <circle cx="650" cy="81" r="5" fill="#0066CC" stroke="#292929" stroke-width="2"/>

  <!-- Gap annotation at step 20: blue=102 (90%), red=330 (36%) -->
  <rect x="850" y="102" width="2" height="228" fill="#F5921B" rx="1"/>
  <text x="864" y="220" fill="#F5921B" font-size="8" font-weight="700">54%</text>
  <text x="864" y="236" fill="#F5921B" font-size="6">gap</text>

  <!-- Legend -->
  <rect x="250" y="22" width="12" height="3" rx="1" fill="#EE0000"/>
  <text x="268" y="26" fill="#C7C7C7" font-size="6">Without checkpoints</text>
  <rect x="600" y="22" width="12" height="3" rx="1" fill="#0066CC"/>
  <text x="618" y="26" fill="#C7C7C7" font-size="6">With checkpoints</text>
</svg>
</div>

---
layout: section
---

<div style="background: #151515; color: #fff; margin: -48px; padding: 48px; height: calc(100% + 96px); display: flex; flex-direction: column; justify-content: center;">
  <p style="font-family: 'Red Hat Mono', monospace; color: #EE0000; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5em;">Act 3</p>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 3em; color: #fff; margin: 0;">So What Was My Journey?</h1>
  <div style="width: 80px; height: 4px; background: #EE0000; margin-top: 0.8em; border-radius: 2px;"></div>
  <p style="color: #A3A3A3; margin-top: 1em; font-size: 1.1em;"></p>
</div>
---

# This wasn't a planned curriculum...

<div class="mt-6" style="font-size: 1.15em; max-width: 85%;">
<p class="mt-4" style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.4em; color: #EE0000;">
  It was necessary discovery
</p>
through LOTS of learning and trial-and-error. 
<br/><br/>

I started where you probably did & I'm definitely not an expert. 
<br/>That is to say, my goal is to learn with others.

</div>

<div class="mt-8" style="display: flex; gap: 1em; flex-wrap: wrap;">
  <span style="display: inline-block; padding: 0.4em 1em; border-radius: 999px; font-size: 0.8em; font-weight: 700; background: #292929; color: #6A6E73; font-family: 'Red Hat Mono';">9 steps</span>
  <span style="display: inline-block; padding: 0.4em 1em; border-radius: 999px; font-size: 0.8em; font-weight: 700; background: #292929; color: #6A6E73; font-family: 'Red Hat Mono';">~6 months</span>
  <span style="display: inline-block; padding: 0.4em 1em; border-radius: 999px; font-size: 0.8em; font-weight: 700; background: #292929; color: #6A6E73; font-family: 'Red Hat Mono';">MANY mistakes</span>
</div>
---

# Hands-On Progression

<div class="flex justify-center mt-2">
<div style="position: relative; padding-left: 40px; max-width: 90%;">

  <!-- Vertical line -->
  <div style="position: absolute; left: 15px; top: 8px; bottom: 8px; width: 3px; background: linear-gradient(to bottom, #EE0000, #0066CC); border-radius: 2px;"></div>

  <!-- Step 1 -->
  <div style="position: relative; margin-bottom: 0.5em; padding-left: 24px;">
    <div style="position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; background: #EE0000; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.65em; font-weight: 700; font-family: 'Red Hat Mono';">1</div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">Tested limits of a single agent</div>
  </div>

  <!-- Step 2 -->
  <div style="position: relative; margin-bottom: 0.5em; padding-left: 24px;">
    <div style="position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; background: #CC1100; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.65em; font-weight: 700; font-family: 'Red Hat Mono';">2</div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">Asked another agent to review</div>
  </div>

  <!-- Step 3 -->
  <div style="position: relative; margin-bottom: 0.5em; padding-left: 24px;">
    <div style="position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; background: #AA2200; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.65em; font-weight: 700; font-family: 'Red Hat Mono';">3</div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">Compared results of multiple agents</div>
  </div>

  <!-- Step 4 -->
  <div style="position: relative; margin-bottom: 0.5em; padding-left: 24px;">
    <div style="position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; background: #883300; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.65em; font-weight: 700; font-family: 'Red Hat Mono';">4</div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">Realized checks and gates are critical</div>
  </div>

  <!-- Step 5 -->
  <div style="position: relative; margin-bottom: 0.5em; padding-left: 24px;">
    <div style="position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; background: #664400; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.65em; font-weight: 700; font-family: 'Red Hat Mono';">5</div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">Realized separation of concern remains relevant</div>
  </div>

  <!-- Step 6 -->
  <div style="position: relative; margin-bottom: 0.5em; padding-left: 24px;">
    <div style="position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; background: #445500; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.65em; font-weight: 700; font-family: 'Red Hat Mono';">6</div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">Began working with agent workflows</div>
  </div>

  <!-- Step 7 -->
  <div style="position: relative; margin-bottom: 0.5em; padding-left: 24px;">
    <div style="position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; background: #226600; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.65em; font-weight: 700; font-family: 'Red Hat Mono';">7</div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">Expanded agent set</div>
  </div>

  <!-- Step 8 -->
  <div style="position: relative; margin-bottom: 0.5em; padding-left: 24px;">
    <div style="position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; background: #117799; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.65em; font-weight: 700; font-family: 'Red Hat Mono';">8</div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">Added policies and standards</div>
  </div>

  <!-- Step 9 -->
  <div style="position: relative; margin-bottom: 0.5em; padding-left: 24px;">
    <div style="position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; background: #0066CC; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.65em; font-weight: 700; font-family: 'Red Hat Mono';">9</div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">Documented the workflow</div>
  </div>

</div>
</div>
---

# Step 1: Tested Limits of a Single Model Session

<div class="mt-6" style="font-size: 1.1em;">

I started just like you probably did. Fired up a session, asked it to build something.
<p class="mt-4" style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.4em; color: #EE0000;">
It *was* impressive -- until it wasn't.
</p>

</div>

<div class="grid grid-cols-2 gap-8 mt-8">
<div class="card" style="border: 1px solid #4D4D4D; border-radius: 8px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #3D7317;">What worked</div>
  <ul style="font-size: 0.9em; margin-top: 0.5em;">
    <li>Small, well-defined tasks</li>
    <li>Code with clear patterns</li>
    <li>Standard library usage</li>
  </ul>
</div>
<div class="card" style="border: 1px solid #4D4D4D; border-radius: 8px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #B1380B;">What didn't</div>
  <ul style="font-size: 0.9em; margin-top: 0.5em;">
    <li>Large, ambiguous requests</li>
    <li>Cross-cutting concerns</li>
    <li>Anything needing project context</li>
  </ul>
</div>
</div>
---

# Step 2: Asked Another Model Session to Review

<div class="mt-6" style="font-size: 1.1em;">

The first time I had one AI review another's work, it caught real problems, but not all of them.

</div>

<div class="mt-6 callout" style="border-left: 4px solid #0066CC; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0; font-size: 1.1em;">

That was the moment I realized my focus shouldn't be **generation**, but **verification**.

</div>

<div class="mt-8" style="display: flex; align-items: center; justify-content: center; gap: 2em;">
  <div style="background: #292929; padding: 1em 1.5em; border-radius: 8px; font-family: 'Red Hat Mono'; font-size: 0.9em;">Agent A: Generate</div>
  <div style="font-size: 1.5em; color: #A3A3A3;">&rarr;</div>
  <div style="background: #292929; padding: 1em 1.5em; border-radius: 8px; font-family: 'Red Hat Mono'; font-size: 0.9em;">Agent B: Review</div>
  <div style="font-size: 1.5em; color: #A3A3A3;">&rarr;</div>
  <div style="background: #3D7317; color: #fff; padding: 1em 1.5em; border-radius: 8px; font-family: 'Red Hat Mono'; font-size: 0.9em;">Higher quality</div>
</div>
---

# Step 3: Compared Multiple Model Session Outputs

<div class="mt-8" style="font-size: 1.1em;">

What if I document a prompt with results from various models and compile?

Different models, different strengths. Not all agents are equal.

</div>

<div class="mt-6" style="font-size: 1em; color: #6A6E73;">

This explained the need for **specialized prompting** -- matching the right model and prompt to the right task.

</div>
---

# Step 4: Checks and Gates Are Critical

<div class="mt-6" style="font-size: 1.1em;">

</div>

<div class="mt-6 callout" style="border-left: 4px solid #EE0000; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0; font-size: 1.15em;">

So, I had an AHA! moment -- now what do I do with that concept?

</div>

<div class="mt-6" style="font-size: 1em;">

What do we know...
- Without gates, each step compounds errors.<br/>
- With gates, we can reset the chain and catch problems earlier.<br/>
- The cost of a checkpoint is minutes, but the cost of uncaught compounding is days.

Tie it together... specialized prompting with gating!
</div>
---

# Step 5: Separation of Concern is bigger than code

<div class="mt-6 callout" style="border-left: 4px solid #EE0000; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0; font-size: 1.15em;">

The product manager shouldn't make architecture decisions, be it human or AI agent.

</div>
<div class="mt-6" style="font-size: 1em;">
<br/>
Real example -- product plan deliverable started specifying technology choices, dependency maps and user stories. The agent was doing project management inside a product document.
<br/><br/><br/>
Specialized prompting & agents is good, but at some point, context size becomes a concern. We need room for reasoning! The solution changed from better prompting to better scope discipline.

</div>
---

# Before We Go Further: What is an Agent?

<div class="mt-4">

An **agent** is an AI model instance given:

- A **role** — a system prompt that defines what it does and how it behaves
- **Tools** — the ability to read files, write code, run commands, search the web
- **Constraints** — boundaries on what it can and cannot do
- **A task** — a specific, scoped piece of work with a verifiable exit condition

</div>

<div class="mt-6 callout" style="border-left: 4px solid #0066CC; padding: 1em 1.5em; background: #292929; border-radius: 0 6px 6px 0;">

An agent is **not** a chatbot. A chatbot answers questions. An agent **takes actions** — it reads your codebase, writes code, runs tests, and iterates on the results.

</div>

---

# Quantifying Constraints

<div class="grid grid-cols-3 gap-6 mt-8">

<div class="card" style="border-top: 4px solid #EE0000; background: #292929; border-radius: 0 0 8px 8px; padding: 1.5em; border: 1px solid #4D4D4D; border-top: 4px solid #EE0000;">
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1.3em; margin-bottom: 0.5em;">Context Horizon</div>
  <div style="font-family: 'Red Hat Mono'; font-size: 2em; color: #EE0000; font-weight: 700; margin-bottom: 0.3em;">3-5 files</div>
  <p style="font-size: 0.85em; color: #6A6E73;">If a task touches more than 5 files, it's over-scoped. More context dilutes attention, not improves it.</p>
</div>

<div class="card" style="border-top: 4px solid #0066CC; background: #292929; border-radius: 0 0 8px 8px; padding: 1.5em; border: 1px solid #4D4D4D; border-top: 4px solid #0066CC;">
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1.3em; margin-bottom: 0.5em;">Deterministic Exit</div>
  <div style="font-family: 'Red Hat Mono'; font-size: 2em; color: #0066CC; font-weight: 700; margin-bottom: 0.3em;">pass / fail</div>
  <p style="font-size: 0.85em; color: #6A6E73;">The agent's goal is not "finish the task" but "pass the check." Every chunk needs a verification script.</p>
</div>

<div class="card" style="border-top: 4px solid #3D7317; background: #292929; border-radius: 0 0 8px 8px; padding: 1.5em; border: 1px solid #4D4D4D; border-top: 4px solid #3D7317;">
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1.3em; margin-bottom: 0.5em;">One-Hour Rule</div>
  <div style="font-family: 'Red Hat Mono'; font-size: 2em; color: #3D7317; font-weight: 700; margin-bottom: 0.3em;">&le; 1 hr</div>
  <p style="font-size: 0.85em; color: #6A6E73;">Long sessions cause "context drift" -- the agent forgets instructions or gets confused by prior outputs.</p>
</div>

</div>
---

# Bad vs. Good Exit Conditions

<div class="mt-6">

| <span style="color: #B1380B;">Bad (Subjective)</span> | <span style="color: #3D7317;">Good (Machine-Verifiable)</span> |
|---|---|
| "Refactor the code to be cleaner" | `ruff check src/` exits 0 |
| "Implementation is complete" | `pytest tests/unit/test_foo.py` passes |
| "Endpoint works correctly" | `curl -s localhost:3000/health \| jq .status` returns `"ok"` |
| "Code follows conventions" | `npx tsc --noEmit` exits 0 |

</div>

<div class="mt-6 callout" style="border-left: 4px solid #0066CC; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0;">

If you can't define a machine-verifiable exit condition, the task is probably underspecified.

</div>

---

# Back to the Journey

<div class="mt-6" style="font-size: 1.15em;">

<p class="mt-6" style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.3em; color: #EE0000;">
  So where were we?
</p>

We had specialized prompting, gating, and separation of concern. We've stated what an agent is and what keeps it on the rails.
<br/><br/>
My next question: what happens when I put multiple agents together?

</div>


---

# Step 6: Agent Workflows

Multi-agent orchestration. Sequencing matters.

<div class="mt-6 callout" style="border-left: 4px solid #EE0000; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0; font-size: 1.15em;">
If I chain a project manager, architect, and engineer together, can I get better results?
</div>
<br/>

What do you mean 'chain' together?
- **Sequential execution** — tasks execute in strict order, output feeds the next
- **Parallel fan-out** — independent tasks run concurrently, then sync
- **Review gates** — mandatory review before proceeding
- **Iterative loops** — profile, fix, verify, repeat until targets are met
<br/><br/>

---

# Step 7: Expanding the Agent Set

<div class="mt-6 callout" style="border-left: 4px solid #EE0000; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0; font-size: 1.15em;">
This is where your journey has to get personal. What roles fit your need?
</div>
<br/>

<p class="mt-4" style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.4em; color: #EE0000;">
It depends on the use case!
</p>
I've settled on 17 agents -- each with a defined role, model tier, and tool set:

<div class="grid grid-cols-2 gap-6 mt-4" style="font-size: 0.85em;">
<div>

- Product Manager
- Requirements Analyst
- Architect
- Tech Lead
- Project Manager
- Backend Developer
- Frontend Developer
- Database Engineer
- API Designer

</div>
<div>

- Code Reviewer
- Test Engineer
- Security Engineer
- Performance Engineer
- DevOps Engineer
- SRE Engineer
- Debug Specialist
- Technical Writer

</div>
</div>

---

# Step 8: The "Constitution"

Policies and standards every agent reads before doing anything.
<br/><br/>
<p class="mt-4" style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.4em; color: #EE0000;">
We need to deal with commonalities.
</p>
<br/>

- Architecture patterns
- Code style & conventions
- Security baseline
- Testing standards
- Error handling
- API conventions
- Review governance

---

# Step 9: The Scaffold

I needed a consistent, reusable template.

The rules, agents, workflows, and conventions could be packaged as a project scaffold that I could adapt as required -- a powerful agent network preloaded with my common needs (AI policies, code style, procedures, etc.)

<div class="mt-8 callout" style="border-left: 4px solid #EE0000; padding: 1em 1.5em; background: #292929; border-radius: 0 6px 6px 0;">
  <p style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.2em; margin: 0;">
    Reminder: I am no expert. I have success with this formula, but YMMV!
  </p>
</div>

---
layout: section
---

<div style="background: #151515; color: #fff; margin: -48px; padding: 48px; height: calc(100% + 96px); display: flex; flex-direction: column; justify-content: center;">
  <p style="font-family: 'Red Hat Mono', monospace; color: #EE0000; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5em;">Act 4</p>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 3em; color: #fff; margin: 0;">Spec-Driven Development</h1>
  <div style="width: 80px; height: 4px; background: #EE0000; margin-top: 0.8em; border-radius: 2px;"></div>
  <p style="color: #A3A3A3; margin-top: 1em; font-size: 1.1em;">Where you getting this crap, Jeremy?</p>
</div>
---

# The Artifact Chain

<div class="flex justify-center mt-6">
<div style="display: flex; align-items: center; gap: 0; max-width: 95%;">

  <!-- Constitution -->
  <div style="background: #151515; color: #fff; padding: 1.2em 1.5em; border-radius: 10px; min-width: 140px; text-align: center; position: relative; z-index: 4; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1em;">Constitution</div>
    <div style="font-size: 0.7em; color: #A3A3A3; margin-top: 0.3em;">CLAUDE.md + Rules</div>
    <div style="font-family: 'Red Hat Mono'; font-size: 0.6em; color: #EE0000; margin-top: 0.4em;">The law of the land</div>
  </div>

  <!-- Arrow 1 -->
  <div style="display: flex; align-items: center; margin: 0 -4px; z-index: 3;">
    <svg width="50" height="30" viewBox="0 0 50 30">
      <path d="M 0 15 L 40 15" stroke="#EE0000" stroke-width="2.5" fill="none"/>
      <path d="M 35 8 L 45 15 L 35 22" stroke="#EE0000" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    </svg>
  </div>

  <!-- Functional Spec -->
  <div style="background: #EE0000; color: #fff; padding: 1.2em 1.5em; border-radius: 10px; min-width: 140px; text-align: center; position: relative; z-index: 4; box-shadow: 0 4px 12px rgba(238,0,0,0.25);">
    <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1em;">Functional Spec</div>
    <div style="font-size: 0.7em; color: rgba(255,255,255,0.8); margin-top: 0.3em;">Replaces the Jira ticket</div>
    <div style="font-family: 'Red Hat Mono'; font-size: 0.6em; color: rgba(255,255,255,0.7); margin-top: 0.4em;">WHAT, not HOW</div>
  </div>

  <!-- Arrow 2 -->
  <div style="display: flex; align-items: center; margin: 0 -4px; z-index: 3;">
    <svg width="50" height="30" viewBox="0 0 50 30">
      <path d="M 0 15 L 40 15" stroke="#EE0000" stroke-width="2.5" fill="none"/>
      <path d="M 35 8 L 45 15 L 35 22" stroke="#EE0000" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    </svg>
  </div>

  <!-- Technical Plan -->
  <div style="background: #0066CC; color: #fff; padding: 1.2em 1.5em; border-radius: 10px; min-width: 140px; text-align: center; position: relative; z-index: 4; box-shadow: 0 4px 12px rgba(0,102,204,0.25);">
    <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1em;">Technical Plan</div>
    <div style="font-size: 0.7em; color: rgba(255,255,255,0.8); margin-top: 0.3em;">Bridge: intent to execution</div>
    <div style="font-family: 'Red Hat Mono'; font-size: 0.6em; color: rgba(255,255,255,0.7); margin-top: 0.4em;">HOW it's structured</div>
  </div>

  <!-- Arrow 3 -->
  <div style="display: flex; align-items: center; margin: 0 -4px; z-index: 3;">
    <svg width="50" height="30" viewBox="0 0 50 30">
      <path d="M 0 15 L 40 15" stroke="#0066CC" stroke-width="2.5" fill="none"/>
      <path d="M 35 8 L 45 15 L 35 22" stroke="#0066CC" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    </svg>
  </div>

  <!-- Task List -->
  <div style="background: #3D7317; color: #fff; padding: 1.2em 1.5em; border-radius: 10px; min-width: 140px; text-align: center; position: relative; z-index: 4; box-shadow: 0 4px 12px rgba(61,115,23,0.25);">
    <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1em;">Task List</div>
    <div style="font-size: 0.7em; color: rgba(255,255,255,0.8); margin-top: 0.3em;">Atomic work units</div>
    <div style="font-family: 'Red Hat Mono'; font-size: 0.6em; color: rgba(255,255,255,0.7); margin-top: 0.4em;">Verifiable chunks</div>
  </div>

</div>
</div>

<div class="mt-6 text-center" style="font-size: 0.95em; color: #6A6E73;">

Each artifact **constrains** the next. Docs elevated to code status.

</div>
---

# The Human Gate

<div class="mt-8 text-center">
  <div style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.8em; color: #393838; line-height: 1.3;">
    The most critical intervention point<br>is <span style="color: #EE0000;">plan review</span>, not code review.
  </div>
</div>

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="card" style="border: 2px solid #3D7317; border-radius: 8px; padding: 1.5em; text-align: center;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #3D7317; font-size: 1.1em;">Correcting a bad plan</div>
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 2.5em; color: #3D7317; margin: 0.2em 0;">Minutes</div>
</div>

<div class="card" style="border: 2px solid #B1380B; border-radius: 8px; padding: 1.5em; text-align: center;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #B1380B; font-size: 1.1em;">Refactoring bad code</div>
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 2.5em; color: #B1380B; margin: 0.2em 0;">Days</div>
</div>

</div>

<div class="mt-4 text-center" style="color: #6A6E73; font-size: 0.95em;">

Changing perspective to focus on review is the fundamental shift. First-class citizen, no longer a simple validation.

</div>
---

# Scope Discipline

<div class="mt-2" style="font-size: 0.95em;">

Each layer stays in its lane. Product says WHAT, architecture says HOW the system is structured.

</div>

<div class="mt-4">

| <span style="color: #3D7317;">Product Scope (correct)</span> | <span style="color: #B1380B;">Architecture Leak (violation)</span> |
|---|---|
| "Document storage with retrieval" | "MinIO S3-compatible object storage" |
| "Real-time chat responses" | "SSE streaming" or "WebSockets" |
| "Workflow orchestration with checkpointing" | "LangGraph with PostgresSaver" |
| "16 features organized by priority" | "16 epics with dependency maps and phase assignments" |

</div>

<div class="mt-4 callout" style="border-left: 4px solid #F5921B; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0;">

When a product plan starts specifying technology or breaking work into epics, the agent has escaped its scope. The fix isn't better prompting -- it's clearer boundaries.

</div>
---

# Constitution in Practice

<div class="mt-4" style="font-size: 0.95em;">

What goes in the "law of the land" -- what every agent reads before doing anything:

</div>

<div class="grid grid-cols-3 gap-3 mt-4">

<div style="background: #292929; border-radius: 6px; padding: 0.8em; font-size: 0.8em;">
  <div style="font-family: 'Red Hat Mono'; color: #EE0000; font-size: 0.85em;">CLAUDE.md</div>
  <div style="color: #6A6E73; margin-top: 0.3em;">Project context, goals, constraints, key decisions</div>
</div>

<div style="background: #292929; border-radius: 6px; padding: 0.8em; font-size: 0.8em;">
  <div style="font-family: 'Red Hat Mono'; color: #EE0000; font-size: 0.85em;">architecture.md</div>
  <div style="color: #6A6E73; margin-top: 0.3em;">Monorepo structure, package dependencies</div>
</div>

<div style="background: #292929; border-radius: 6px; padding: 0.8em; font-size: 0.8em;">
  <div style="font-family: 'Red Hat Mono'; color: #EE0000; font-size: 0.85em;">code-style.md</div>
  <div style="color: #6A6E73; margin-top: 0.3em;">Naming, formatting, import order</div>
</div>

<div style="background: #292929; border-radius: 6px; padding: 0.8em; font-size: 0.8em;">
  <div style="font-family: 'Red Hat Mono'; color: #EE0000; font-size: 0.85em;">security.md</div>
  <div style="color: #6A6E73; margin-top: 0.3em;">Input handling, auth, transport, secrets</div>
</div>

<div style="background: #292929; border-radius: 6px; padding: 0.8em; font-size: 0.8em;">
  <div style="font-family: 'Red Hat Mono'; color: #EE0000; font-size: 0.85em;">testing.md</div>
  <div style="color: #6A6E73; margin-top: 0.3em;">Coverage targets, naming, isolation</div>
</div>

<div style="background: #292929; border-radius: 6px; padding: 0.8em; font-size: 0.8em;">
  <div style="font-family: 'Red Hat Mono'; color: #EE0000; font-size: 0.85em;">error-handling.md</div>
  <div style="color: #6A6E73; margin-top: 0.3em;">RFC 7807, status codes, error hierarchy</div>
</div>

<div style="background: #292929; border-radius: 6px; padding: 0.8em; font-size: 0.8em;">
  <div style="font-family: 'Red Hat Mono'; color: #EE0000; font-size: 0.85em;">api-conventions.md</div>
  <div style="color: #6A6E73; margin-top: 0.3em;">REST design, pagination, versioning</div>
</div>

<div style="background: #292929; border-radius: 6px; padding: 0.8em; font-size: 0.8em;">
  <div style="font-family: 'Red Hat Mono'; color: #EE0000; font-size: 0.85em;">review-governance.md</div>
  <div style="color: #6A6E73; margin-top: 0.3em;">PR size, anti-rubber-stamping, review gates</div>
</div>

<div style="background: #292929; border-radius: 6px; padding: 0.8em; font-size: 0.8em;">
  <div style="font-family: 'Red Hat Mono'; color: #EE0000; font-size: 0.85em;">agent-workflow.md</div>
  <div style="color: #6A6E73; margin-top: 0.3em;">Task chunking, context engineering</div>
</div>

</div>

---
layout: section
---

<div style="background: #151515; color: #fff; margin: -48px; padding: 48px; height: calc(100% + 96px); display: flex; flex-direction: column; justify-content: center;">
  <p style="font-family: 'Red Hat Mono', monospace; color: #EE0000; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5em;">Act 5</p>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 3em; color: #fff; margin: 0;">Thinking about and communicating concepts</h1>
  <div style="width: 80px; height: 4px; background: #EE0000; margin-top: 0.8em; border-radius: 2px;"></div>
  <p style="color: #A3A3A3; margin-top: 1em; font-size: 1.1em;">I don't have answers, just suggestions.</p>
</div>
---

# Bolts, Not Sprints

<div class="mt-4" style="font-size: 1em;">

**Scope-boxed, not time-boxed.** A 2-hour bolt for a bug, a 3-day bolt for a feature.

</div>

<div class="mt-4" style="font-size: 0.95em; color: #6A6E73;">

Syncs replace stand-ups: "What is the agent stuck on?" and "Is the plan valid?" -- not "What are you working on?"

</div>

<!-- Bolt Lifecycle: Two-bar comparison -->
<div class="flex justify-center mt-6">
<div style="width: 90%; max-width: 700px;">

  <!-- AI bar -->
  <div style="display: flex; align-items: center; gap: 0.8em; margin-bottom: 0.4em;">
    <div style="width: 70px; font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em; text-align: right; color: #A3A3A3;">AI</div>
    <div style="flex: 1; display: flex; height: 48px; border-radius: 6px; overflow: hidden;">
      <div style="width: 5%; background: #0066CC; display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.7em;"></div>
      <div style="width: 85%; background: #EE0000; display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">BUILD ~85%</div>
      <div style="width: 10%; background: #3D7317; display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.7em;"></div>
    </div>
  </div>

  <!-- Human bar -->
  <div style="display: flex; align-items: center; gap: 0.8em; margin-bottom: 0.6em;">
    <div style="width: 70px; font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em; text-align: right; color: #A3A3A3;">Human</div>
    <div style="flex: 1; display: flex; height: 48px; border-radius: 6px; overflow: hidden;">
      <div style="width: 40%; background: #0066CC; display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">SPEC ~40%</div>
      <div style="width: 10%; background: #EE0000; display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.7em;"></div>
      <div style="width: 50%; background: #3D7317; display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Red Hat Display'; font-weight: 700; font-size: 0.85em;">VERIFY ~50%</div>
    </div>
  </div>

  <!-- Legend -->
  <div style="display: flex; justify-content: center; gap: 2em; font-size: 0.75em; color: #6A6E73; margin-top: 0.3em;">
    <div><span style="display: inline-block; width: 10px; height: 10px; background: #0066CC; border-radius: 2px; margin-right: 0.4em; vertical-align: middle;"></span>Spec &mdash; requirements, design, exit conditions</div>
    <div><span style="display: inline-block; width: 10px; height: 10px; background: #EE0000; border-radius: 2px; margin-right: 0.4em; vertical-align: middle;"></span>Build &mdash; implementation, iteration, unit tests</div>
    <div><span style="display: inline-block; width: 10px; height: 10px; background: #3D7317; border-radius: 2px; margin-right: 0.4em; vertical-align: middle;"></span>Verify &mdash; review, security, integration testing</div>
  </div>

</div>
</div>
---

# Role Evolution

<div class="grid grid-cols-3 gap-5 mt-6">

<!-- Juniors -->
<div style="background: #292929; border: 1px solid #4D4D4D; border-radius: 10px; overflow: hidden;">
  <div style="background: #0066CC; color: #fff; padding: 0.8em 1em; font-family: 'Red Hat Display'; font-weight: 700;">
    Engineers
  </div>
  <div style="padding: 1em; font-size: 0.85em;">
    <div style="font-weight: 700; margin-bottom: 0.5em;">Become: AI Supervisors</div>
    <ul style="padding-left: 1.2em; line-height: 1.6;">
      <li>Take a spec, prompt the agent</li>
      <li>Rigorously verify the output</li>
      <li>Learn by reading AI code and finding flaws</li>
    </ul>
  </div>
</div>

<!-- Mid-level -->
<div style="background: #292929; border: 1px solid #4D4D4D; border-radius: 10px; overflow: hidden;">
  <div style="background: #EE0000; color: #fff; padding: 0.8em 1em; font-family: 'Red Hat Display'; font-weight: 700;">
    Seniors
  </div>
  <div style="padding: 1em; font-size: 0.85em;">
    <div style="font-weight: 700; margin-bottom: 0.5em;">Become: Specifiers + Reviewers</div>
    <ul style="padding-left: 1.2em; line-height: 1.6;">
      <li>Specify features precisely</li>
      <li>Review results critically</li>
      <li>Ensure agents get quality context</li>
    </ul>
  </div>
</div>

<!-- Tech Leads -->
<div style="background: #292929; border: 1px solid #4D4D4D; border-radius: 10px; overflow: hidden;">
  <div style="background: #151515; color: #fff; padding: 0.8em 1em; font-family: 'Red Hat Display'; font-weight: 700;">
    Principals+
  </div>
  <div style="padding: 1em; font-size: 0.85em;">
    <div style="font-weight: 700; margin-bottom: 0.5em;">Become: Process Architects</div>
    <ul style="padding-left: 1.2em; line-height: 1.6;">
      <li>Write and maintain the constitution</li>
      <li>Debug the AI process</li>
      <li>Ensure high-quality context feeding</li>
    </ul>
  </div>
</div>

</div>

<div class="mt-4 callout" style="border-left: 4px solid #0066CC; padding: 0.6em 1em; background: #292929; border-radius: 0 6px 6px 0; font-size: 0.95em;">

The conversation shifts from "How do I write this loop?" to "Is this the right design pattern for this service?"

</div>
---

# New Metrics

<div class="grid grid-cols-2 gap-8 mt-6">
<div>

| Metric | Signal |
|--------|--------|
| Code survival rate | % of AI output still in codebase after 3 months |
| Review-to-coding ratio | Was ~1:4, now should be 1:1 or 2:1 |

</div>
<div>

### Less focus on...

<div class="mt-4">

<div style="display: flex; align-items: center; gap: 0.8em; margin-bottom: 1em;">
  <div style="background: #B1380B; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1em; flex-shrink: 0;">&times;</div>
  <div>
    <div style="font-weight: 700;">Lines of code</div>
    <div style="font-size: 0.85em; color: #6A6E73;">AI inflates this to meaninglessness</div>
  </div>
</div>

<div style="display: flex; align-items: center; gap: 0.8em;">
  <div style="background: #B1380B; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1em; flex-shrink: 0;">&times;</div>
  <div>
    <div style="font-weight: 700;">Velocity in story points</div>
    <div style="font-size: 0.85em; color: #6A6E73;">Measures generation speed, not quality</div>
  </div>
</div>

</div>
</div>
</div>
---

# Governance: Three Rules

<div class="mt-4" style="font-size: 0.95em; color: #6A6E73;">

Three rules to maintaining our mental model:

</div>

<div class="grid grid-cols-3 gap-5 mt-6">

<div style="background: #292929; border: 2px solid #EE0000; border-radius: 10px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1.6em; color: #EE0000; margin-bottom: 0.3em;">01</div>
  <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 1em; margin-bottom: 0.5em;">Gated Human Review</div>
  <p style="font-size: 0.85em; color: #6A6E73;">Progress stops until concensus is reached betweeh human and machine. No rubber stamping.</p>
</div>

<div style="background: #292929; border: 2px solid #EE0000; border-radius: 10px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1.6em; color: #EE0000; margin-bottom: 0.3em;">02</div>
  <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 1em; margin-bottom: 0.5em;">Small PRs Only</div>
  <p style="font-size: 0.85em; color: #6A6E73;">Hard size limits. Reject agent-generated large changesets. ~400 lines max for meaningful human review.</p>
</div>

<div style="background: #292929; border: 2px solid #EE0000; border-radius: 10px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1.6em; color: #EE0000; margin-bottom: 0.3em;">03</div>
  <div style="font-family: 'Red Hat Display'; font-weight: 700; font-size: 1em; margin-bottom: 0.5em;">"Explain It to Me"</div>
  <p style="font-size: 0.85em; color: #6A6E73;">Engineer must be able to explain logic in conversation (no model). <br/>PR's should be rejected if unable -- full-stop. Hold yourself accountable, rubber ducking helps.</p>
</div>

</div>

<div class="mt-4 text-center" style="font-size: 0.9em; color: #6A6E73;">

These aren't bureaucracy -- they're the artificial friction that prevents engineers from becoming passengers.

</div>

---

<!-- BREAK -->

<div class="h-full flex flex-col justify-center items-center text-center" style="background: #151515; color: #fff; margin: -48px; padding: 48px;">
  <div style="font-family: 'Red Hat Mono', monospace; color: #EE0000; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 1em;">Break Time!</div>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 3em; color: #fff; margin: 0;">Stretch, Refill, Recharge</h1>
  <div style="width: 80px; height: 4px; background: #EE0000; margin-top: 1.5em; border-radius: 2px;"></div>
</div>

---
layout: section
---

<div style="background: #151515; color: #fff; margin: -48px; padding: 48px; height: calc(100% + 96px); display: flex; flex-direction: column; justify-content: center;">
  <p style="font-family: 'Red Hat Mono', monospace; color: #EE0000; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5em;">Act 6</p>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 3em; color: #fff; margin: 0;">Same Prompt, Different Process</h1>
  <div style="width: 80px; height: 4px; background: #EE0000; margin-top: 0.8em; border-radius: 2px;"></div>
  <p style="color: #A3A3A3; margin-top: 1em; font-size: 1.1em;">What does each level of rigor actually produce?</p>
</div>
---

# The Prompt

<div class="flex justify-center mt-8">

<div style="background: #292929; border-left: 4px solid #0066CC; border-radius: 0 8px 8px 0; padding: 1.5em 2em; max-width: 85%; font-size: 1.2em; line-height: 1.6; font-family: 'Red Hat Mono', monospace;">

"I'm building a SaaS platform. Product wants users to be able to schedule reports -- pick a report type, set a cadence, and have it delivered to their team automatically. Help me plan and build this feature."

</div>

</div>

<div class="mt-8" style="color: #6A6E73; font-size: 0.95em;">

Same prompt, given to four different setups. No extra guidance, no follow-up.

</div>

---

# Gemini 3 Pro

<div class="grid grid-cols-2 gap-6 mt-4">
<div>

**Produced:** 3 planning documents (README, plan, architecture)

- Went straight to architecture
- Named specific tools (BullMQ, SendGrid, Puppeteer) without asking what's in the stack
- Included SQL schemas with indexing strategy
- Flagged open questions -- at the end

</div>
<div>

<div style="background: #292929; border-radius: 8px; padding: 1em 1.2em; margin-bottom: 1em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #3D7317; font-size: 0.9em;">Strengths</div>
  <ul style="font-size: 0.8em; line-height: 1.7; padding-left: 1.2em; margin-top: 0.3em;">
    <li>Practical distributed systems thinking</li>
    <li>Security-aware (RLS, pre-signed URLs)</li>
    <li>Honest about what it doesn't know</li>
  </ul>
</div>

<div style="background: #292929; border-radius: 8px; padding: 1em 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #B1380B; font-size: 0.9em;">Gaps</div>
  <ul style="font-size: 0.8em; line-height: 1.7; padding-left: 1.2em; margin-top: 0.3em;">
    <li>Zero clarifying questions asked</li>
    <li>No API contracts (request/response shapes)</li>
    <li>Missing DST, month-boundary edge cases</li>
  </ul>
</div>

</div>
</div>

---

# Claude Sonnet 4.5

<div class="grid grid-cols-2 gap-6 mt-4">
<div>

**Produced:** 4 documents (~2,000 lines) including a decision guide with code examples

- Jumped to architecture + implementation details
- Included Redis commands, S3 lifecycle policies, retry delay arrays
- Proposed 6-phase roadmap (15-21 weeks)
- Put UI in Phase 5 (last)

</div>
<div>

<div style="background: #292929; border-radius: 8px; padding: 1em 1.2em; margin-bottom: 1em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #3D7317; font-size: 0.9em;">Strengths</div>
  <ul style="font-size: 0.8em; line-height: 1.7; padding-left: 1.2em; margin-top: 0.3em;">
    <li>Most comprehensive single-pass output</li>
    <li>Practical code examples save implementation time</li>
    <li>Risk-aware with mitigation strategies</li>
  </ul>
</div>

<div style="background: #292929; border-radius: 8px; padding: 1em 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #B1380B; font-size: 0.9em;">Gaps</div>
  <ul style="font-size: 0.8em; line-height: 1.7; padding-left: 1.2em; margin-top: 0.3em;">
    <li>Zero clarifying questions asked</li>
    <li>Over-specified before validating requirements</li>
    <li>Recipients as JSONB (data model problem)</li>
    <li>UI last -- users can't validate until Phase 5</li>
  </ul>
</div>

</div>
</div>

---

# Claude Opus 4.6

<div class="grid grid-cols-2 gap-6 mt-4">
<div>

**Produced:** 1 comprehensive architecture doc (447 lines)

- Jumped to architecture, but flagged 5 assumptions and 6 open questions explicitly
- Included state machines, risk register, phased rollout
- More focused -- half the output of Sonnet, more strategic depth

</div>
<div>

<div style="background: #292929; border-radius: 8px; padding: 1em 1.2em; margin-bottom: 1em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #3D7317; font-size: 0.9em;">Strengths</div>
  <ul style="font-size: 0.8em; line-height: 1.7; padding-left: 1.2em; margin-top: 0.3em;">
    <li>Explicit about what it assumed vs. what needs answers</li>
    <li>Operational thinking (monitoring, SLIs, capacity)</li>
    <li>Timezone handling as day-1 concern, not afterthought</li>
  </ul>
</div>

<div style="background: #292929; border-radius: 8px; padding: 1em 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #B1380B; font-size: 0.9em;">Gaps</div>
  <ul style="font-size: 0.8em; line-height: 1.7; padding-left: 1.2em; margin-top: 0.3em;">
    <li>Still didn't ask questions -- just flagged them</li>
    <li>Skipped requirements phase entirely</li>
    <li>Assumptions not validated before designing</li>
  </ul>
</div>

</div>
</div>

---

# Opus Reviews Sonnet's Work

<div class="mt-4" style="font-size: 0.95em;">

What happens when we add one review gate? Opus reviewed Sonnet's plan and found:

</div>

<div class="grid grid-cols-2 gap-6 mt-4">

<div style="background: #292929; border: 2px solid #B1380B; border-radius: 8px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #B1380B; margin-bottom: 0.5em;">Problems Found</div>
  <ul style="font-size: 0.8em; line-height: 1.8; padding-left: 1.2em;">
    <li>Zero questions asked -- "most serious mistake"</li>
    <li>Recipients stored as JSONB -- should be a proper table</li>
    <li>UI in Phase 5 -- users can't validate until the end</li>
    <li>Timezone handling deferred to Phase 3 -- should be foundational</li>
    <li>Implementation details masquerading as planning</li>
  </ul>
</div>

<div style="background: #292929; border: 2px solid #3D7317; border-radius: 8px; padding: 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #3D7317; margin-bottom: 0.5em;">Opus's Corrections</div>
  <ul style="font-size: 0.8em; line-height: 1.8; padding-left: 1.2em;">
    <li>Identified 7 questions that should have been asked first</li>
    <li>Proposed proper recipients table with foreign keys</li>
    <li>Moved UI to Phase 1 -- validate with users early</li>
    <li>Made timezone a day-1 data model concern</li>
    <li>3 authorization design options with trade-offs</li>
  </ul>
</div>

</div>

<div class="mt-4 callout" style="border-left: 4px solid #0066CC; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0; font-size: 0.95em;">

One review pass caught structural problems that would have taken days to refactor in code.

</div>

---

# My Scaffold System

<div class="grid grid-cols-2 gap-6 mt-4">
<div>

**Produced:** 12 documents across 3 review gates

<div style="font-size: 0.85em; margin-top: 0.5em;">

1. Product Manager writes product plan
2. Architect, API Designer, Security Engineer review it
3. Architect designs system architecture
4. Security Engineer, API Designer review it
5. Requirements Analyst writes requirements
6. Product Manager, Architect review them

</div>

</div>
<div>

<div style="background: #292929; border-radius: 8px; padding: 1em 1.2em; margin-bottom: 1em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #3D7317; font-size: 0.9em;">What Changed</div>
  <ul style="font-size: 0.8em; line-height: 1.7; padding-left: 1.2em; margin-top: 0.3em;">
    <li>Product plan has zero technology names</li>
    <li>Architecture stays in its lane</li>
    <li>Requirements have testable acceptance criteria</li>
    <li>8 reviewer passes -- no rubber-stamping</li>
    <li>Process indicates a technical design still to go</li>
  </ul>
</div>

<div style="background: #292929; border-radius: 8px; padding: 1em 1.2em;">
  <div style="font-family: 'Red Hat Display'; font-weight: 700; color: #F5921B; font-size: 0.9em;">Still Not Perfect</div>
  <ul style="font-size: 0.8em; line-height: 1.7; padding-left: 1.2em; margin-top: 0.3em;">
    <li>No stakeholder interview recorded</li>
    <li>Optional resolutions via human review or architect</li>
    <li>Report generation is still a stub</li>
  </ul>
</div>

</div>
</div>

---

# The Comparison

<div class="mt-2" style="font-size: 0.75em;">

| | Gemini 3 Pro | Sonnet 4.5 | Opus 4.6 | Scaffold |
|---|---|---|---|---|
| **Artifacts** | 3 docs | 4 docs | 1 doc | 12 docs (4 primary + 8 reviews) |
| **Questions asked** | 0 | 0 | 0 (flagged 11) | Resolved through review gates |
| **First action** | Architecture | Architecture + code | Architecture | Product plan |
| **Scope discipline** | Mixed | Mixed | Mixed | Clean lane separation |
| **Review gates** | 0 | 0 | 0 | 3 gates, 8 passes |
| **Tech in product scope** | Yes | Yes | Inherited | No |

</div>

<div class="mt-4 callout" style="border-left: 4px solid #EE0000; padding: 0.8em 1.2em; background: #292929; border-radius: 0 6px 6px 0; font-size: 1em;">

Every model produced useful output. The difference is how many decisions were made *for* you without asking -- and how many of those could or would have been wrong.

</div>

---

# The Takeaway

<div class="mt-6" style="font-size: 1.15em;">

<p style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.4em; color: #EE0000;">
  The models aren't the problem. The process is the differentiator.
</p>

</div>

<div class="grid grid-cols-3 gap-5 mt-6">

<div style="background: #292929; border-top: 4px solid #A3A3A3; border-radius: 0 0 8px 8px; padding: 1.2em; text-align: center;">
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1.8em; color: #A3A3A3;">Solo</div>
  <p style="font-size: 0.85em; color: #6A6E73; margin-top: 0.5em;">Model makes every ambiguous decision for you. You find out later which ones were wrong.</p>
</div>

<div style="background: #292929; border-top: 4px solid #0066CC; border-radius: 0 0 8px 8px; padding: 1.2em; text-align: center;">
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1.8em; color: #0066CC;">+ Review</div>
  <p style="font-size: 0.85em; color: #6A6E73; margin-top: 0.5em;">A second model catches structural problems. Cheaper than refactoring code.</p>
</div>

<div style="background: #292929; border-top: 4px solid #EE0000; border-radius: 0 0 8px 8px; padding: 1.2em; text-align: center;">
  <div style="font-family: 'Red Hat Display'; font-weight: 900; font-size: 1.8em; color: #EE0000;">+ Process</div>
  <p style="font-size: 0.85em; color: #6A6E73; margin-top: 0.5em;">Decisions surface at the right layer. Each artifact constrains the next. Humans gate progression.</p>
</div>

</div>

---
layout: section
---

<div style="background: #151515; color: #fff; margin: -48px; padding: 48px; height: calc(100% + 96px); display: flex; flex-direction: column; justify-content: center;">
  <p style="font-family: 'Red Hat Mono', monospace; color: #EE0000; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5em;">Act 7</p>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 3em; color: #fff; margin: 0;">Show & Tell</h1>
  <div style="width: 80px; height: 4px; background: #EE0000; margin-top: 0.8em; border-radius: 2px;"></div>
  <p style="color: #A3A3A3; margin-top: 1em; font-size: 1.1em;">My scaffolding</p>
</div>
---
layout: section
---

<div style="background: #151515; color: #fff; margin: -48px; padding: 48px; height: calc(100% + 96px); display: flex; flex-direction: column; justify-content: center;">
  <p style="font-family: 'Red Hat Mono', monospace; color: #EE0000; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5em;">Act 8</p>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 3em; color: #fff; margin: 0;">Wrap-Up & Adoption Path</h1>
  <div style="width: 80px; height: 4px; background: #EE0000; margin-top: 0.8em; border-radius: 2px;"></div>
  <p style="color: #A3A3A3; margin-top: 1em; font-size: 1.1em;">10 minutes</p>
</div>
---

# Ease Into It

<div class="mt-4" style="font-size: 0.95em; color: #6A6E73;">

Don't try the full workflow from day one. Build trust incrementally.

</div>

<div class="mt-6" style="max-width: 85%;">

<!-- Vertical steps -->
<div style="display: flex; align-items: flex-start; gap: 1em; margin-bottom: 1em;">
  <div style="width: 36px; height: 36px; background: #EE0000; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-family: 'Red Hat Display'; flex-shrink: 0;">1</div>
  <div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700;">Start with plan mode</div>
    <div style="font-size: 0.85em; color: #6A6E73;">Have the AI plan before it codes</div>
  </div>
</div>

<div style="display: flex; align-items: flex-start; gap: 1em; margin-bottom: 1em;">
  <div style="width: 36px; height: 36px; background: #CC1100; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-family: 'Red Hat Display'; flex-shrink: 0;">2</div>
  <div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700;">Try two-agent review</div>
    <div style="font-size: 0.85em; color: #6A6E73;">Have a second agent review the first's output</div>
  </div>
</div>

<div style="display: flex; align-items: flex-start; gap: 1em; margin-bottom: 1em;">
  <div style="width: 36px; height: 36px; background: #993300; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-family: 'Red Hat Display'; flex-shrink: 0;">3</div>
  <div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700;">Write a spec before prompting</div>
    <div style="font-size: 0.85em; color: #6A6E73;">Even a short one dramatically improves output quality</div>
  </div>
</div>

<div style="display: flex; align-items: flex-start; gap: 1em; margin-bottom: 1em;">
  <div style="width: 36px; height: 36px; background: #445588; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-family: 'Red Hat Display'; flex-shrink: 0;">4</div>
  <div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700;">Add policies as you learn</div>
    <div style="font-size: 0.85em; color: #6A6E73;">Standards and conventions emerge from what goes wrong</div>
  </div>
</div>

<div style="display: flex; align-items: flex-start; gap: 1em;">
  <div style="width: 36px; height: 36px; background: #0066CC; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-family: 'Red Hat Display'; flex-shrink: 0;">5</div>
  <div>
    <div style="font-family: 'Red Hat Display'; font-weight: 700;">Full SDD cycle when ready</div>
    <div style="font-size: 0.85em; color: #6A6E73;">The scaffold is there when you need the complete workflow</div>
  </div>
</div>

</div>
---

# Resources

<div class="grid grid-cols-2 gap-6 mt-8">

<div>

### References

<div style="margin-top: 1em;">

<div style="display: flex; align-items: center; gap: 0.8em; margin-bottom: 1.2em;">
  <div style="width: 8px; height: 8px; background: #EE0000; border-radius: 2px; flex-shrink: 0;"></div>
  <div>
    <div style="font-weight: 700;">Agent Scaffold Repository</div>
    <div style="font-size: 0.8em; color: #6A6E73; font-family: 'Red Hat Mono';">The template for AI-native projects</div>
  </div>
</div>

<div style="display: flex; align-items: center; gap: 0.8em; margin-bottom: 1.2em;">
  <div style="width: 8px; height: 8px; background: #EE0000; border-radius: 2px; flex-shrink: 0;"></div>
  <div>
    <div style="font-weight: 700;">AI-Native Team Playbook</div>
    <div style="font-size: 0.8em; color: #6A6E73; font-family: 'Red Hat Mono';">docs/ai-native-team-playbook.md</div>
  </div>
</div>

<div style="display: flex; align-items: center; gap: 0.8em; margin-bottom: 1.2em;">
  <div style="width: 8px; height: 8px; background: #EE0000; border-radius: 2px; flex-shrink: 0;"></div>
  <div>
    <div style="font-weight: 700;">AI Compliance Checklist</div>
    <div style="font-size: 0.8em; color: #6A6E73; font-family: 'Red Hat Mono';">docs/ai-compliance-checklist.md</div>
  </div>
</div>

<div style="display: flex; align-items: center; gap: 0.8em;">
  <div style="width: 8px; height: 8px; background: #0066CC; border-radius: 2px; flex-shrink: 0;"></div>
  <div>
    <div style="font-weight: 700;">Google Spec Kit</div>
    <div style="font-size: 0.8em; color: #6A6E73; font-family: 'Red Hat Mono';">External reference for spec-driven approaches</div>
  </div>
</div>

</div>
</div>

<div class="flex items-center justify-center">


</div>

</div>
---

# Closing

<div class="flex flex-col items-center justify-center mt-6">

<div style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 1.6em; color: #3f3e3e; text-align: center; line-height: 1.4; max-width: 80%;">

Use case matters. My workflow is full-on concept design and documentation. Yours might differ.

<span style="color: #EE0000;">That's fine.</span>

</div>

<div class="mt-8 callout" style="border-left: 4px solid #0066CC; padding: 1em 1.5em; background: #292929; border-radius: 0 6px 6px 0; max-width: 75%; font-size: 1.05em;">

It's all about **gating for understanding and guidance**. The tools change. The models improve. But the need for humans to understand what they're shipping never goes away.

</div>

</div>
---

# Q&A

<div class="flex flex-col items-center justify-center mt-12">

<div class="prompt-box" style="background: #292929; border: 2px dashed #4D4D4D; border-radius: 8px; padding: 2em 3em; text-align: center; max-width: 70%;">

<p style="font-family: 'Red Hat Display', sans-serif; font-weight: 700; font-size: 1.3em; color: #ffffff; margin-bottom: 0.5em;">
  Questions?
</p>

<p style="font-size: 1em; color: #6A6E73;">
  <br/>My questions for you:<br/><br/>
  What's one thing you'll try differently this week?
  <br/>What comes after that?
</p>

</div>

</div>
---

<!-- END SLIDE -->

<div class="h-full flex flex-col justify-center items-center text-center" style="background: #151515; color: #fff; margin: -48px; padding: 48px;">
  <div style="width: 120px; height: 4px; background: #EE0000; margin-bottom: 2em; border-radius: 2px;"></div>
  <h1 style="font-family: 'Red Hat Display', sans-serif; font-weight: 900; font-size: 2.5em; color: #fff; margin: 0;">
    You got this.
  </h1>
  <div style="width: 120px; height: 4px; background: #EE0000; margin-top: 2em; border-radius: 2px;"></div>
</div>
