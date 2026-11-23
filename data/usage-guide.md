# DepthDoc usage guide

DepthDoc documents are Markdown with **depth layers**: collapsible sections tagged by who they are for. Pick an audience at the top of the screen (Executive, Product / PM or Engineer) and DepthDoc opens just the layers meant for that reader. Everything else stays one click away.

This guide is read-only and always sits at the top of the sidebar. Every syntax DepthDoc understands is listed below.

## Writing and viewing

:::executive[Write and View modes]
- **Write** shows the Markdown editor next to a live preview. Click a block in the preview to select its source in the editor; double-click to put the cursor on that exact spot.
- **View** is a clean reading page. Hover or click the lines at the top right to open the contents and jump to any section. Jumping opens the section if it was collapsed.
- **Executive / Product / PM / Engineer** set which layers start open. **Expand All** and **Collapse All** open or close every layer. Clicking a layer's header toggles just that layer.
:::

:::executive[Files and saving]
- Your documents are saved as `.md` files in the `data/saved/` folder of the project.
- **New** creates a draft file. **Save File** (or `Ctrl+S` / `Cmd+S`) writes the open document to disk.
- The first `# Heading` in a document becomes its name in the sidebar.
- The bin icon deletes a document after you confirm. This guide cannot be edited or deleted.
- If you edit a file in another editor, click it in the sidebar to load the latest version.
:::

## Depth layers

:::executive[Layer blocks]
Open a layer with `:::type[Title]` on its own line, and close it with `:::` on its own line.

```markdown
:::executive[Why we are building this]
A short summary for leadership.
:::
```

| Opening line | Badge | Opened by preset |
| :--- | :--- | :--- |
| `:::executive[Title]` | Exec | Executive, Product / PM, Engineer |
| `:::product[Title]` | Product | Product / PM, Engineer |
| `:::details[Title]` | Details | Product / PM, Engineer |
| `:::technical[Title]` | Tech | Engineer |
| `:::deep-dive[Title]` | Deep Dive | Engineer |

`:::accordion[Title]` and `:::level[Title]` are other names for `:::details[Title]`. The `[Title]` part is optional; without it the layer gets a default title such as "Technical Architecture Details".

:::product[Nesting layers]
Layers can sit inside each other. Close each one with its own `:::`, innermost first.

```markdown
:::executive[Rollout]
The plan in one paragraph.

:::product[Pilot]
Who gets it first.

:::technical[Feature flags]
How the pilot is switched on.
:::
:::
:::
```

- A product layer inside another product layer is labelled **Product L2**, **Product L3** and so on.
- Executive layers always stay at the top level. Starting a new `:::executive[...]` closes the executive layer that is open, along with everything inside it.
- Opening a deeper layer with a preset also opens the layers around it.
:::

:::details[HTML details blocks]
Standard HTML `<details>` blocks also become layers, with the Details badge. Each tag must be on its own line.

```markdown
<details>
<summary>Open questions</summary>
Anything still undecided.
</details>
```
:::
:::

## Text and structure

:::details[Headings, paragraphs and emphasis]
- `# Title` to `#### Small heading` make headings. Headings at level 2 and 3 appear in the View mode contents.
- Lines next to each other join into one paragraph. Leave a blank line to start a new one.
- `**bold**` gives **bold**, `*italic*` gives *italic*, and backticks give `inline code`.
- `[link text](https://example.com)` makes a link that opens in a new tab.
- `---`, `***` or `___` on its own line draws a horizontal rule.
- Lines starting with `>` make a quote. Lines next to each other join into one quote.

> A quote looks like this.
:::

:::details[Lists]
- Start lines with `-`, `*` or `+` for a bulleted list.
- Start lines with `1.`, `2.` and so on for a numbered list.
- `- [ ] task` and `- [x] task` make a checklist.
- Indented items are shown at the same level as the rest of the list.

- [x] A finished task
- [ ] An open task
:::

:::details[Tables]
Write a header row, then a separator row, then the data rows. Colons in the separator set the alignment.

```markdown
| Metric | Baseline | Target |
| :--- | :---: | ---: |
| Allocation time | 4.5 h | 0.8 h |
```

| Metric | Baseline | Target |
| :--- | :---: | ---: |
| Allocation time | 4.5 h | 0.8 h |

`:---` aligns left, `:---:` centres and `---:` aligns right.
:::

:::technical[Code blocks]
Fence code with three backticks or three tildes. A word after the opening fence labels the language, and every block gets a Copy button.

```python
def total_hours(tasks):
    return sum(task.hours for task in tasks)
```

Anything inside a code fence is shown exactly as written, including `:::` lines.
:::

## Maths

:::deep-dive[Inline and display formulas]
Formulas are rendered with KaTeX.

- **Inline:** wrap the formula in single dollar signs. `$\rho_u > 0.9$` gives $\rho_u > 0.9$. There must be no space just inside the dollar signs.
- **Display:** put the formula between `$$` and `$$` on its own line, or across several lines.
- Plain amounts such as $5 or $1,200 stay as text.

```markdown
$$C = w_1 T + w_2 L - w_3 S$$
```

$$C = w_1 T + w_2 L - w_3 S$$

$$
\mathcal{L}(x, \lambda) = f(x) + \sum_{i=1}^{m} \lambda_i g_i(x)
$$
:::
