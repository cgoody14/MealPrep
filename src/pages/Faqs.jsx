import { useState, useRef, useMemo } from 'react'

const SECTIONS = [
  {
    title: 'Adding recipes',
    items: [
      {
        q: 'How do I import a recipe from a website?',
        a: <>On the <strong>Recipes</strong> page, paste the recipe URL into the <em>Import Recipe</em> bar and tap <strong>Import</strong>. Rouxlo will pull the name, ingredients, instructions, cook time, servings, and nutrition automatically. Review the preview, make any edits, and tap <strong>Save to Recipes</strong>.</>
      },
      {
        q: 'How do I add a recipe from a photo of a cookbook?',
        a: <>Tap <strong>Upload Recipe Photo(s)</strong> on the Recipes page and pick one or more images. You can select multiple pages of the same recipe and Rouxlo will read them as one continuous list of steps. Review the extracted recipe and save.</>
      },
      {
        q: 'Can AI create a recipe from just an idea?',
        a: <>Yes. On the <strong>Recipes</strong> page, find <strong>Describe a recipe</strong>, type what you're craving (e.g. "a cozy chicken pot pie" or "spicy Thai peanut noodles"), and tap <strong>✨ Generate</strong>. AI writes a full recipe — ingredients, steps, and nutrition — which you can review, tweak, and save.</>
      },
      {
        q: "A website I tried won't import — what now?",
        a: <>Some sites (like AllRecipes) block automated requests with bot protection. When that happens, take a screenshot of the recipe and use the <strong>Upload Recipe Photo</strong> option instead — it works for any site. If the page partially loaded, a manual form will appear so you can fill in the missing details.</>
      },
      {
        q: 'Can I add a recipe without importing?',
        a: <>Yes. If a URL or photo import fails to extract everything, a fallback form appears letting you fill in name, ingredients, instructions, and tags by hand. You can also edit any saved recipe and add ingredients/steps from scratch.</>
      },
    ]
  },
  {
    title: 'Editing recipes',
    items: [
      {
        q: 'How do I edit a recipe I already saved?',
        a: <>Tap any recipe card to open its detail view, then tap <strong>Edit</strong>. You can change the name, rating, ingredients, instructions, cook time, servings, nutrition, tags, notes, source URL, and photos. Tap <strong>Save Changes</strong> when done.</>
      },
      {
        q: 'Can I use AI to tweak a recipe?',
        a: <>Yes. Right after importing or generating a recipe, use the <strong>✨ Adjust with AI</strong> bar in the preview — type a change like "make it vegetarian," "halve the servings," or "convert to metric" and AI rewrites the ingredients, steps, and nutrition. You can also adjust an <strong>already-saved</strong> recipe: open it and tap <strong>✨ Adjust with AI</strong>.</>
      },
      {
        q: 'How do I delete a recipe?',
        a: <>Open the recipe detail view, scroll to the bottom, and tap <strong>Delete recipe</strong>. This permanently removes the recipe from your library (and from anyone else in your household).</>
      },
      {
        q: 'How do I mark a recipe as cooked?',
        a: <>From the <strong>This Week</strong> tab, tap the <strong>Mark Made</strong> button on a meal card. The button turns green to show it's been made today, the cooked count goes up by one, and the last-made date updates. Tap it again to undo.</>
      },
      {
        q: 'Can I re-import a recipe to refresh its ingredients or instructions?',
        a: <>Yes. If a recipe has a source URL, open its detail view, tap <strong>Edit</strong>, and use the re-import option to pull fresh data from the original site. Useful when the original recipe has been updated or you originally imported an incomplete version.</>
      },
    ]
  },
  {
    title: 'Households (sharing)',
    items: [
      {
        q: 'What is a household?',
        a: <>A household is a shared recipe library. Everyone in the household sees the same recipes, week plan, and shopping list. Perfect for couples or families that cook together.</>
      },
      {
        q: 'How do I share my recipes with a partner or family member?',
        a: <>Open <strong>Settings</strong> and find your <strong>6-character invite code</strong>. Tap <strong>Share</strong> to send it via message, email, or any sharing app. The recipient creates a Rouxlo account, then enters your code in <em>Settings → Join a Household</em>. Your libraries merge automatically (duplicates by name are kept as one).</>
      },
      {
        q: 'Someone gave me an invite code — where do I enter it?',
        a: <>If you have a Rouxlo account already, open <strong>Settings → Join a Household</strong> and type the code. If you're signing up for the first time, there's also a code field on the signup screen — enter it there and you'll join automatically after creating your account.</>
      },
      {
        q: 'How do I leave or remove someone from a household?',
        a: <>In <strong>Settings</strong>, scroll to the Members list. Tap <strong>Leave</strong> next to your own name to leave (you'll get your own household with your existing recipes). If you created the household, you'll see <strong>Remove</strong> next to other members.</>
      },
    ]
  },
  {
    title: 'Planning & shopping',
    items: [
      {
        q: 'How does the Meal Randomizer work?',
        a: <>Open the <strong>Meal Randomizer</strong> tab, pick how many meals you want, set a cooldown (so recently-cooked dishes are skipped), and optionally specify ingredients you'd like to use up. Rouxlo weights selections by rating and cook history. Selected meals can be added directly to your week.</>
      },
      {
        q: 'How do I plan meals for the week?',
        a: <>From any recipe card, tap <strong>Add to Week</strong>. On the <strong>This Week</strong> page you can assign each meal to a specific day, scale ingredients (½×, 1×, 2×) or change serving counts, and re-order as needed.</>
      },
      {
        q: 'How does the shopping list work?',
        a: <>The <strong>Shopping List</strong> automatically combines ingredients from every meal in your week, grouped by category (Produce, Proteins, Dairy, etc.). You can mark items you already have, tick off items as you shop, and view per-recipe breakdowns under the <em>By Recipe</em> section.</>
      },
      {
        q: 'What is Cook Mode?',
        a: <>When you're ready to cook a meal, open its detail view and tap <strong>Cook Mode</strong>. It takes over the full screen with large, step-by-step instructions and auto-detects timers from the instructions so you can tap to start them. Your phone screen stays on while Cook Mode is active.</>
      },
    ]
  },
  {
    title: 'App basics',
    items: [
      {
        q: 'How do I switch to dark mode?',
        a: <>Open <strong>Settings</strong> and toggle <strong>Dark mode</strong>. Your preference is saved and will persist across devices.</>
      },
      {
        q: "How do I install Rouxlo on my phone's home screen?",
        a: <><strong>iPhone:</strong> Open rouxlo.com in Safari, tap the Share button, then "Add to Home Screen." <strong>Android:</strong> Open in Chrome, tap the menu (⋮), then "Add to Home Screen" or "Install app." Once installed, Rouxlo opens like a regular app — no browser bar, faster startup.</>
      },
      {
        q: 'I forgot my password — what do I do?',
        a: <>On the Sign In screen, tap <strong>Forgot password?</strong> below the Sign In button. Enter your email and you'll receive a reset link. Open the link, set a new password, and you'll be signed in automatically.</>
      },
    ]
  },
]

function FaqItem({ id, q, a, isOpen, onToggle, setRef }) {
  return (
    <div ref={setRef} className={`faq-item${isOpen ? ' open' : ''}`}>
      <button
        type="button"
        className="faq-question"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
      >
        <span className="faq-q-text">{q}</span>
        <span className="faq-chevron" aria-hidden="true">›</span>
      </button>
      {isOpen && <div className="faq-answer">{a}</div>}
    </div>
  )
}

const ALL_ITEMS = SECTIONS.flatMap((section, sIdx) =>
  section.items.map((item, iIdx) => ({
    id: `${sIdx}-${iIdx}`,
    section: section.title,
    q: item.q,
  }))
)

export default function Faqs() {
  const [openId, setOpenId] = useState(null)
  const [query, setQuery] = useState('')
  const itemRefs = useRef({})

  const handleToggle = (id) => setOpenId(prev => prev === id ? null : id)

  const trimmedQuery = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!trimmedQuery) return []
    return ALL_ITEMS.filter(item => item.q.toLowerCase().includes(trimmedQuery))
  }, [trimmedQuery])

  const handleSelectResult = (id) => {
    setQuery('')
    setOpenId(id)
    requestAnimationFrame(() => {
      const el = itemRefs.current[id]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">FAQs</h1>
        </div>
      </div>
      <p className="page-subtitle">Quick answers to common questions about using Rouxlo.</p>

      <div className="faq-search-wrap">
        <input
          type="search"
          className="form-input faq-search-input"
          placeholder="Search questions…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          spellCheck={false}
        />
        {trimmedQuery && (
          <div className="faq-search-results">
            {matches.length === 0 ? (
              <div className="faq-search-empty">No matching questions.</div>
            ) : (
              matches.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className="faq-search-result"
                  onClick={() => handleSelectResult(m.id)}
                >
                  <span className="faq-search-result-section">{m.section}</span>
                  <span className="faq-search-result-q">{m.q}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="faq-list">
        {SECTIONS.map((section, sIdx) => (
          <div key={section.title} className="faq-section">
            <h2 className="faq-section-title">{section.title}</h2>
            {section.items.map((item, iIdx) => {
              const id = `${sIdx}-${iIdx}`
              return (
                <FaqItem
                  key={id}
                  id={id}
                  q={item.q}
                  a={item.a}
                  isOpen={openId === id}
                  onToggle={handleToggle}
                  setRef={el => { itemRefs.current[id] = el }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
