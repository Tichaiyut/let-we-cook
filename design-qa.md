# Design QA — Epic / Story / Task / Bug hierarchy refinement

## Evidence

- Source visual truth: `C:\Users\Admin\Desktop\LetHimCook\let-him-cook-board\implementation-card-content-fixed.png` (accepted Kanban card state before hierarchy metadata).
- Browser-rendered Board: `C:\Users\Admin\Desktop\LetHimCook\let-him-cook-board\implementation-epic-story-board.png`.
- Browser-rendered Create form: `C:\Users\Admin\Desktop\LetHimCook\let-him-cook-board\implementation-epic-story-create.png`.
- Browser-rendered top view: `C:\Users\Admin\Desktop\LetHimCook\let-him-cook-board\implementation-epic-story-top.png`.
- Full comparison input: `C:\Users\Admin\Desktop\LetHimCook\let-him-cook-board\design-comparison-epic-story-full.png`.
- Focused card comparison input: `C:\Users\Admin\Desktop\LetHimCook\let-him-cook-board\design-comparison-epic-story-card.png`.
- Browser viewport: 1265 × 712 CSS px, device scale factor 1.
- Implementation captures: 1265 × 712 px. The focused card comparison normalizes both card crops to 242 px wide; the full comparison resizes the implementation to 598 px wide for a compact side-by-side view.
- State: Board tab, live read-only task data loaded, all top filters set to All for the main capture. Two local-only demo items were created to verify a Task and Bug under `Performance Dashboard`.

## Findings

No actionable P0, P1, or P2 differences remain.

- Information architecture: legacy Project values are presented as Epic values; legacy tasks remain Task items with `Unassigned story`. New items can be Task or Bug and carry an Epic plus Story.
- Fonts and typography: existing type scale and compact card hierarchy remain consistent. Epic/Story metadata uses a deliberately smaller supporting style so task titles remain primary.
- Spacing and layout rhythm: the create form is grouped into Hierarchy and Work details sections. Kanban cards remain fixed at 124 px and the column body fits exactly five cards.
- Colors and visual tokens: the modal border follows the selected Epic color; Bug chips use the existing semantic red; Task chips use a neutral blue-gray.
- Image quality and asset fidelity: no new raster or icon assets were introduced; existing Phosphor icons and blank avatar placeholders remain crisp.
- Copy and content: the Story filter exposes `Unassigned story`; the card breadcrumb reads `Epic › Story`; the create form exposes Issue type, Epic, Story, and New story name.
- Interaction: selecting an Epic limits the Story choices; selecting `+ Create new story` reveals the new Story name field; selecting the Story filter isolates matching work items.

## Measured behavior

- Legacy data: 214 source tasks render as Task items with null Story; Story filter `Unassigned story` returns 214 items.
- Local demo data: 1 Task and 1 Bug under `ifarm ไก่ไข่ › Performance Dashboard`; total visible work becomes 216.
- Kanban: 33 To Do, 31 In Progress, and 129 Done items in the All state.
- Kanban body: 648 px visible height, 124 px card height, 7 px row gap; `5 × 124 + 4 × 7 = 648`, so exactly five complete cards are visible.
- Kanban overflow: all columns use independent vertical scrolling; no sampled card has `scrollHeight > clientHeight`.
- Page width: 1265 px document width equals the 1265 px viewport width; no unintended page-level horizontal overflow.
- Browser console: no errors or warnings.
- Production build passed.
- All four Sites-ready worker tests passed.

## Comparison history

### Previous state

- Cards contained only task-level metadata and did not expose Issue type or Epic/Story context.
- The create form accepted a Project and did not support Story or Bug creation.

### Hierarchy refinement — passed

- Normalized legacy Project → Epic, legacy rows → Task, Story → null, Parent ID → null without writing to the original Google Sheet.
- Added Story filter with an `Unassigned story` state.
- Added Task/Bug issue type, Epic, Story, and create-new-Story flow to the modal.
- Added Epic › Story breadcrumbs and issue-type chips to Kanban cards and expanded cards to preserve readable metadata while retaining five-card density.
- Focused and full comparison evidence show the hierarchy metadata is integrated without changing the product’s existing task-tracker visual language.

## Open questions

- None for this scoped prototype iteration.

## Follow-up polish

- P3: once the hierarchy is approved, add a dedicated Story/Hierarchy view with roll-up progress from child Tasks and Bugs.

## Final result

passed
