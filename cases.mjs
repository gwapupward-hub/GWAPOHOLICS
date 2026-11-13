// Each case is a fictional teaching simulation informed by the stated historical era.
// Numbers and outcomes are illustrative, NOT claims about real companies' finances.
//
// Every case is a chain of four linked decisions, three options each.
// - An option's `tags` say what it sets up for the rest of the chain.
// - An option's `links` add or subtract cash when an EARLIER decision in the same chain set a matching tag.
//   Each link carries a short `note`, shown to the player only after the chain is committed.
// - Stage 0 options can shift once, based on the case's evidence driver.
export const DIMENSIONS = [
  { key: "timeHorizon", name: "Time horizon", short: "Long-game thinking" },
  { key: "successMetric", name: "Success metric", short: "What you measure" },
  { key: "riskAppetite", name: "Risk appetite", short: "Calculated risk" },
  { key: "concentration", name: "Concentration", short: "Spread your bets" },
  { key: "leadership", name: "Leadership", short: "Managing people" },
  { key: "decisionStyle", name: "Decision style", short: "Evidence vs instinct" },
  { key: "socialProof", name: "Social proof", short: "Crowd independence" },
  { key: "commitment", name: "Commitment", short: "Knowing when to pivot" },
  { key: "valueSignal", name: "Value signal", short: "Spotting value" },
  { key: "rootCause", name: "Root cause", short: "Solving what matters" }
];

export const CASES = [
  {
    id: "streaming-pivot",
    number: "01",
    category: "Business Strategy",
    era: "2007 • Media",
    difficulty: "Rookie",
    minutes: 5,
    title: "The Streaming Pivot",
    hook: "Your biggest revenue stream is about to become yesterday's business.",
    story: "You run a fictional DVD delivery company. Broadband is getting faster, and streaming looks promising. Investors want growth. Existing customers still love DVDs. You have 90 days to set your strategy.",
    inspiration: "Inspired by the industry's shift from physical media to internet streaming in the 2000s. The company, figures, and modeled results here are fictional.",
    takeaway: "Your earlier bets decide which later moves pay. Match the pace to your runway, then build on what you already set up.",
    driver: { min: 4, max: 24, evidenceIndex: 2, suffix: " mo", shiftWhen: "below", threshold: 9 },
    evidence: [
      { label: "DVD revenue", value: "78%", note: "of current sales" },
      { label: "Streaming users", value: "+42%", note: "estimated annual growth" },
      { label: "Cash runway", value: "18 mo", note: "at current spend" }
    ],
    stages: [
      {
        prompt: "Where do you put your next $10 million?",
        options: [
          { id: "all-in", label: "Go all-in on streaming", detail: "Move fast. Rebuild the product before rivals catch up.", risk: "High risk", delta: -220, tags: ["digital", "bold"], links: [], profile: { timeHorizon: 2, riskAppetite: 2, concentration: -2, commitment: 1 }, outcome: "You bet the next $10 million on streaming before the audience was ready, and the infrastructure bill arrived first." },
          { id: "protect", label: "Protect the DVD machine", detail: "Improve margins and let others prove streaming demand.", risk: "Lower risk", delta: 90, tags: ["physical"], links: [], profile: { successMetric: 1, riskAppetite: -1, commitment: -1, timeHorizon: -1 }, outcome: "You squeezed more margin from DVDs and let rivals spend first on streaming.", shifted: { delta: 200, outcome: "With little runway left, protecting DVD cash kept the company alive while you planned the next move." } },
          { id: "hybrid", label: "Fund a controlled streaming pilot", detail: "Keep DVDs profitable while testing a smaller digital offering.", risk: "Balanced", delta: 100, tags: ["digital", "physical"], links: [], profile: { timeHorizon: 2, decisionStyle: 2, concentration: 2, valueSignal: 1 }, outcome: "You funded a small streaming pilot, and DVD cash paid for the experiment.", shifted: { delta: -60, outcome: "The pilot ate into thin cash, leaving no buffer for the quarters ahead." } }
        ]
      },
      {
        setup: "A rival just announced a studio partnership, and subscribers are asking where to watch, not where to buy. Your board wants a plan for the next two quarters.",
        prompt: "What is your priority for the next two quarters?",
        options: [
          { id: "content-deal", label: "Bid for exclusive studio content", detail: "Spend heavily on one flagship exclusive to win subscribers fast.", risk: "High risk", delta: -140, tags: ["bold"], links: [{ tag: "digital", amount: 210, note: "Exclusive titles have a platform to land on, so subscribers arrive fast." }, { tag: "physical", amount: -180, note: "Exclusives can't reach disc-only customers, so the cost stays on the books." }], profile: { riskAppetite: 2, concentration: -1, socialProof: -1 }, outcome: "The exclusive deal lifted sign-ups for a season, but its cost stayed on the books long after the buzz faded." },
          { id: "library-app", label: "Build a library app for your catalog", detail: "Let subscribers stream the titles you already own.", risk: "Balanced", delta: 60, tags: ["digital"], links: [{ tag: "physical", amount: 40, note: "Your existing disc catalog fills the app on day one." }], profile: { timeHorizon: 1, decisionStyle: 1, rootCause: 2, valueSignal: 1 }, outcome: "Your own app let subscribers stream the catalog you already owned, and cancellations began to slow." },
          { id: "studio-licence", label: "License a studio's back catalog", detail: "Pay for proven titles and grow the library at lower risk.", risk: "Lower risk", delta: 110, tags: ["physical"], links: [{ tag: "digital", amount: 40, note: "A working app makes licensed titles worth more to subscribers." }], profile: { successMetric: 1, riskAppetite: -1, commitment: 1 }, outcome: "Licensed titles filled the app quickly, and the library grew without betting the budget on one exclusive." }
        ]
      },
      {
        setup: "Your streaming library is growing, but the warehouse still ships discs and delivery costs keep climbing. Your operations director wants a decision this week.",
        prompt: "What happens to the mail-order warehouse?",
        options: [
          { id: "close-warehouse", label: "Close the warehouse this quarter", detail: "Cut disc costs now and move every customer to streaming.", risk: "High risk", delta: -100, tags: ["bold", "digital"], links: [{ tag: "digital", amount: 170, note: "The app can absorb the warehouse's customers without a gap." }, { tag: "physical", amount: -140, note: "Disc-first customers leave before the app is ready for them." }], profile: { riskAppetite: 2, concentration: -2, leadership: -1 }, outcome: "Closing the warehouse saved money on paper, but loyal disc customers left faster than the app could absorb them." },
          { id: "dual-run", label: "Run both channels for another year", detail: "Keep discs alive while the app earns its place.", risk: "Balanced", delta: 70, tags: ["physical", "digital"], links: [], profile: { timeHorizon: 1, leadership: 1, decisionStyle: 1 }, outcome: "Running both channels for another year kept disc customers while the app earned its place." },
          { id: "keep-warehouse", label: "Keep the warehouse as it is", detail: "Avoid disruption and let disc revenue carry the costs.", risk: "Lower risk", delta: 60, tags: ["physical"], links: [{ tag: "physical", amount: 50, note: "Disc margins are still strong, so keeping the warehouse pays." }, { tag: "digital", amount: -190, note: "You'd be running a warehouse for customers who already moved to streaming." }], profile: { successMetric: 1, commitment: -1 }, outcome: "The warehouse kept shipping discs, but rising delivery costs ate most of the margin you had saved." }
        ]
      },
      {
        setup: "The quarter is closing, and investors want a clear story. Your cash balance tells a different story than your pitch deck.",
        prompt: "What do you tell investors?",
        options: [
          { id: "promise-growth", label: "Promise explosive subscriber growth", detail: "Lead with the boldest projection and worry about the numbers later.", risk: "High risk", delta: -110, tags: ["bold"], links: [{ tag: "bold", amount: 250, note: "Investors buy a bold story when the chain already committed to one." }, { tag: "physical", amount: -90, note: "Flat disc revenue makes a growth promise hard to believe." }], profile: { successMetric: -2, socialProof: -1, riskAppetite: 2 }, outcome: "You promised explosive growth, and the next quarter's shortfall turned the promise into a credibility problem." },
          { id: "cohort-honest", label: "Show cohort data and a realistic plan", detail: "Share retention, margins, and what you will test next.", risk: "Balanced", delta: 100, tags: ["honest"], links: [{ tag: "digital", amount: 50, note: "Digital cohorts give you real retention data to show." }], profile: { successMetric: 2, valueSignal: 1, decisionStyle: 2, commitment: 1 }, outcome: "Honest cohort data gave investors a plan they could check, and the round closed on realistic terms." },
          { id: "margin-story", label: "Lead with the disc margin story", detail: "Stress profitability of the existing business and hold streaming back.", risk: "Lower risk", delta: 110, tags: ["physical"], links: [{ tag: "physical", amount: 50, note: "Healthy disc margins make the margin story credible." }, { tag: "bold", amount: -120, note: "A margin story sounds defensive after a bold bet." }], profile: { successMetric: 1, riskAppetite: -1, timeHorizon: -1 }, outcome: "The margin story kept investors calm, but it said little about where the business was heading." }
        ]
      }
    ],
    verdicts: {
      strong: "You turned a shrinking channel into a platform, one measured bet at a time.",
      steady: "You kept the business solvent and brought streaming in at a pace you could afford.",
      rough: "You made real progress on streaming, but the pace or the cash left you exposed.",
      collapse: "The shift to streaming outran your cash, and the company ran out of room to recover."
    }
  },
  {
    id: "brand-backlash",
    number: "02",
    category: "Marketing & Brand",
    era: "1985 • Consumer brands",
    difficulty: "Street smart",
    minutes: 5,
    title: "The Brand Backlash",
    hook: "The taste test says yes. Your loyal customers might say no.",
    story: "Your fictional beverage giant is losing share to a rival. Blind taste tests favor a sweeter recipe, but your original product is part of customers' identity. The board demands a bold move.",
    inspiration: "Inspired by the 1985 New Coke controversy. Brand, metrics, and simulated payoffs are fictional.",
    takeaway: "Loyalty and change both carry risk. The move that works depends on what your earlier launch did to the people who already love the product.",
    driver: { min: 52, max: 66, evidenceIndex: 0, suffix: "%", shiftWhen: "atLeast", threshold: 60 },
    evidence: [
      { label: "Blind preference", value: "57%", note: "prefer new formula" },
      { label: "Brand loyalty", value: "Very high", note: "among core buyers" },
      { label: "Rival pressure", value: "+6 pts", note: "share in test markets" }
    ],
    stages: [
      {
        prompt: "What's your launch strategy?",
        options: [
          { id: "replace", label: "Replace the original nationwide", detail: "Make the new product the one and only flagship.", risk: "High risk", delta: -250, tags: ["bold", "change"], links: [], profile: { socialProof: -1, riskAppetite: 2, valueSignal: -1, rootCause: -2 }, outcome: "You replaced the original nationwide, and loyal buyers answered with a backlash that outran the taste tests." },
          { id: "defend", label: "Double down on the original", detail: "Invest in the brand story and defend distribution.", risk: "Lower risk", delta: 120, tags: ["classic"], links: [], profile: { commitment: 1, successMetric: 1, valueSignal: 1 }, outcome: "You defended the original, kept loyal buyers close, and watched the share gap with the rival widen." },
          { id: "test", label: "Launch a second line in test cities", detail: "Protect the classic while learning what new buyers want.", risk: "Balanced", delta: 100, tags: ["change", "classic"], links: [], profile: { decisionStyle: 2, leadership: 1, rootCause: 2, concentration: 1 }, outcome: "You launched a second line in test cities, so the classic stayed put while curious buyers tried the new recipe.", shifted: { delta: 200, outcome: "Strong taste data backed a second line, which turned curiosity into share while loyalists were left alone." } }
        ]
      },
      {
        setup: "Rivals are watching closely, and the press calls this a referendum on your brand. Retailers want a clear answer on shelf space.",
        prompt: "How do you handle the retail partners?",
        options: [
          { id: "shelf-demand", label: "Demand full shelf space for the new product", detail: "Push retailers to drop the old packaging everywhere.", risk: "High risk", delta: -100, tags: ["bold"], links: [{ tag: "change", amount: 230, note: "Retailers reorder fast when the new product is already winning share." }, { tag: "classic", amount: -180, note: "Pushing the classic off shelves angers the buyers who still want it." }], profile: { riskAppetite: 2, socialProof: -1, leadership: 1 }, outcome: "Retailers complied under protest, and some reordered from rivals once the backlash began." },
          { id: "copromo", label: "Co-promote both products in every store", detail: "Offer retailers a joint display that keeps both lines visible.", risk: "Balanced", delta: 40, tags: ["change", "classic"], links: [], profile: { decisionStyle: 1, leadership: 2, concentration: 1 }, outcome: "Co-promotion kept both products on display, so retailers stayed friendly while buyers chose for themselves." },
          { id: "keep-shelf", label: "Keep the shelf as it is for now", detail: "Hold the current layout and avoid a fight with retailers.", risk: "Lower risk", delta: 40, tags: ["classic"], links: [{ tag: "classic", amount: 90, note: "Loyal buyers find the original where they expect it." }, { tag: "change", amount: -170, note: "Holding the old shelf wastes a launch that was already working." }], profile: { commitment: -1, successMetric: 1 }, outcome: "You kept shelf space unchanged, which avoided a fight but cost you visibility with new buyers." }
        ]
      },
      {
        setup: "A focus group splits: some loyal buyers feel betrayed, and a competitor's ad mocks the change.",
        prompt: "How do you respond to the critics?",
        options: [
          { id: "counter-ad", label: "Run a sharp counter-ad", detail: "Mock the rival back and make the debate personal.", risk: "High risk", delta: -130, tags: ["bold"], links: [{ tag: "bold", amount: 300, note: "The bold launch gives the counter-ad something sharp to answer." }, { tag: "classic", amount: -50, note: "Attacking critics feels wrong to loyal buyers who wanted the classic kept." }], profile: { riskAppetite: 2, socialProof: -2, valueSignal: -1 }, outcome: "The counter-ad drew attention, but it turned a product debate into a fight that loyal buyers resented." },
          { id: "listen-adjust", label: "Listen publicly and adjust the packaging", detail: "Acknowledge the feedback and offer the classic in limited runs.", risk: "Balanced", delta: 60, tags: ["classic", "change"], links: [], profile: { socialProof: 2, leadership: 1, rootCause: 1, commitment: 1 }, outcome: "Public listening and limited classic runs calmed buyers, and the debate moved from anger to curiosity." },
          { id: "let-pass", label: "Let the criticism pass", detail: "Stay quiet and let the news cycle move on.", risk: "Lower risk", delta: 140, tags: ["classic"], links: [{ tag: "bold", amount: -90, note: "A bold launch invites a response, and silence reads as conceding." }], profile: { socialProof: 1, commitment: 1, riskAppetite: -1 }, outcome: "You stayed quiet, and the news cycle moved on before the criticism could harden into a lasting story." }
        ]
      },
      {
        setup: "Earnings season is here, and the board wants to know whether the brand is stronger than last year.",
        prompt: "What do you say about the brand?",
        options: [
          { id: "clean-win", label: "Declare a clean win", detail: "Report the rollout as a triumph and skip the critics.", risk: "High risk", delta: -90, tags: ["bold"], links: [{ tag: "bold", amount: 80, note: "A visible, bold launch gives the board a headline the numbers can back." }, { tag: "classic", amount: -60, note: "The classic's losses don't fit a clean-win story." }], profile: { successMetric: -2, socialProof: -1, riskAppetite: 1 }, outcome: "You declared a clean win, and the board noticed that the numbers did not match the headline." },
          { id: "mixed-report", label: "Report mixed results with a plan", detail: "Show the gains, the losses, and what you will change next.", risk: "Balanced", delta: 70, tags: ["honest"], links: [], profile: { successMetric: 2, decisionStyle: 2, valueSignal: 1 }, outcome: "You reported mixed results with a plan, and the board trusted a manager who could explain the gaps." },
          { id: "stable-core", label: "Point to the stable core business", detail: "Emphasize the classic's loyal base and leave the new line in the footnotes.", risk: "Lower risk", delta: 20, tags: ["classic"], links: [{ tag: "classic", amount: 140, note: "The stable core is the story, and it held up." }], profile: { commitment: 1, successMetric: 1, timeHorizon: -1 }, outcome: "You pointed to the stable core business, which reassured the board but left the new line's lessons unexamined." }
        ]
      }
    ],
    verdicts: {
      strong: "You kept the classic, heard the new buyers, and let the brand grow in both directions.",
      steady: "You protected the brand's core and kept the rivalry from turning into a crisis.",
      rough: "The launch dented loyalty and share, and the brand recovered only partly.",
      collapse: "The backlash outran the strategy, and the brand spent the year defending its own name."
    }
  },
  {
    id: "supply-shock",
    number: "03",
    category: "Operations & Scale",
    era: "2020 • Global trade",
    difficulty: "Operator",
    minutes: 6,
    title: "The Supply Shock",
    hook: "Your top supplier just shut down. Customers still want their orders.",
    story: "Your fictional consumer electronics business relies on one overseas factory. A global disruption blocks shipments. You can protect margin, buy inventory, or rebuild the supply chain.",
    inspiration: "Inspired by supply-chain disruptions during 2020. Specific facts and game outcomes are simulated.",
    takeaway: "Cheap supply is fragile supply. Resilience and cash each pay off only when the earlier choices made them possible.",
    driver: { min: 2, max: 8, evidenceIndex: 1, suffix: " wks", shiftWhen: "atLeast", threshold: 6 },
    evidence: [
      { label: "Top supplier", value: "82%", note: "of production" },
      { label: "Stock cover", value: "5 wks", note: "before shelves empty" },
      { label: "New vendor cost", value: "+18%", note: "per unit" }
    ],
    stages: [
      {
        prompt: "How do you keep the business alive?",
        options: [
          { id: "stockpile", label: "Borrow heavily and stockpile", detail: "Lock down all remaining inventory before competitors do.", risk: "High risk", delta: -300, tags: ["debt", "stock"], links: [], profile: { riskAppetite: 2, concentration: -2, timeHorizon: -1 }, outcome: "You borrowed heavily to stockpile, and financing and storage costs filled the warehouse faster than cash came in." },
          { id: "wait", label: "Wait it out and trim overhead", detail: "Preserve cash while your main supplier recovers.", risk: "Lower risk", delta: -70, tags: ["cash"], links: [], profile: { successMetric: 1, leadership: -1, timeHorizon: -1 }, outcome: "You trimmed overhead and waited for the supplier, keeping cash while losing orders.", shifted: { delta: 190, outcome: "Six or more weeks of stock gave your supplier room to recover, so waiting kept cash in reserve with few lost orders." } },
          { id: "diversify", label: "Qualify two alternative suppliers", detail: "Accept thinner margins now for more reliable fulfillment.", risk: "Balanced", delta: 50, tags: ["supplier"], links: [], profile: { concentration: 2, rootCause: 2, leadership: 1, timeHorizon: 1 }, outcome: "You qualified two alternative suppliers, and thinner margins bought a steadier flow of parts." }
        ]
      },
      {
        setup: "A new vendor's quote arrives with a surcharge, and the port backlog keeps growing. Your operations lead needs a decision today.",
        prompt: "How do you sign the new supply contracts?",
        options: [
          { id: "long-contracts", label: "Sign long contracts with fixed volumes", detail: "Lock in capacity for years, even if demand is uncertain.", risk: "High risk", delta: -110, tags: ["debt"], links: [{ tag: "supplier", amount: 260, note: "Two vendors already in place make long commitments safer." }, { tag: "cash", amount: -160, note: "Fixed volumes are hard to fund when cash is already thin." }], profile: { riskAppetite: 2, timeHorizon: 1, concentration: -1 }, outcome: "Long fixed-volume contracts guaranteed capacity, but they locked in costs just as demand softened." },
          { id: "flex-terms", label: "Negotiate flexible terms with two vendors", detail: "Pay a premium for the right to change volumes later.", risk: "Balanced", delta: 40, tags: ["supplier"], links: [], profile: { decisionStyle: 2, concentration: 1, leadership: 1 }, outcome: "Flexible terms with two vendors cost a premium, but they let you adjust volumes as the backlog cleared." },
          { id: "spot-premium", label: "Buy spot at whatever price is offered", detail: "Stay unlocked and pay the market rate for each shipment.", risk: "Lower risk", delta: -80, tags: ["cash"], links: [{ tag: "cash", amount: 40, note: "Spot buying works when you still have cash to move quickly." }, { tag: "debt", amount: -150, note: "Paying spot premiums on borrowed money doubles the strain." }], profile: { riskAppetite: -1, commitment: -1, valueSignal: -1 }, outcome: "Buying spot kept you unlocked, but every shipment cost more than the one before it." }
        ]
      },
      {
        setup: "Retail buyers want firm delivery dates for the holiday season, and one of your key products is running short.",
        prompt: "Which orders get priority?",
        options: [
          { id: "largest-accounts", label: "Serve the largest accounts first", detail: "Protect your biggest customers and let smaller orders wait.", risk: "Lower risk", delta: 100, tags: ["accounts"], links: [{ tag: "supplier", amount: 170, note: "Two suppliers can cover the largest accounts' orders on time." }], profile: { successMetric: 1, leadership: 1, concentration: -1 }, outcome: "Serving the largest accounts first protected your biggest revenue, and smaller buyers were asked to wait." },
          { id: "even-split", label: "Split stock evenly across all orders", detail: "Give every retailer a partial shipment and an honest date.", risk: "Balanced", delta: 70, tags: ["trust"], links: [], profile: { socialProof: 1, leadership: 2, decisionStyle: 1 }, outcome: "An even split gave every retailer a partial shipment and an honest date, which kept most buyers loyal." },
          { id: "resale-hold", label: "Hold stock to resell at a premium", detail: "Sell the scarce product at spot prices to whoever pays the most.", risk: "High risk", delta: -90, tags: ["stock"], links: [{ tag: "stock", amount: 40, note: "Scarce stock sells at a premium when you actually have inventory." }, { tag: "supplier", amount: -140, note: "With several suppliers, scarcity doesn't last long enough to resell." }], profile: { riskAppetite: 2, socialProof: -2, valueSignal: -1 }, outcome: "Holding stock for premium resale brought in quick cash, but buyers who were promised deliveries never came back." }
        ]
      },
      {
        setup: "The supply chain is steadier, or at least less broken. Your team wants to know where the next investment should go.",
        prompt: "What is the next investment?",
        options: [
          { id: "own-factory", label: "Build your own factory", detail: "Bring production in-house to control quality and timing.", risk: "High risk", delta: -80, tags: ["debt"], links: [{ tag: "supplier", amount: 260, note: "Two suppliers taught you where the bottlenecks are, so a factory is a sure bet." }, { tag: "debt", amount: -250, note: "A factory on borrowed money adds a second strain." }], profile: { riskAppetite: 2, concentration: -1, timeHorizon: 1 }, outcome: "Building your own factory gave you control, but construction and ramp-up consumed cash for two quarters." },
          { id: "automate", label: "Automate the existing lines", detail: "Invest in equipment that raises output at current sites.", risk: "Balanced", delta: 30, tags: ["trust"], links: [], profile: { rootCause: 2, decisionStyle: 1, timeHorizon: 1 }, outcome: "Automating the existing lines raised output at current sites, and it kept climbing through the next season." },
          { id: "reserve", label: "Build a strategic reserve", detail: "Hold capital for the next shock instead of spending it now.", risk: "Lower risk", delta: 150, tags: ["cash"], links: [{ tag: "cash", amount: 50, note: "A reserve only matters if you kept cash on hand." }, { tag: "stock", amount: -130, note: "A warehouse full of stock already acts as a reserve." }], profile: { timeHorizon: 1, commitment: 1, riskAppetite: -1 }, outcome: "A strategic reserve sat ready for the next shock, which made the company much harder to surprise." }
        ]
      }
    ],
    verdicts: {
      strong: "You turned a fragile supply chain into a resilient one, and customers noticed.",
      steady: "You kept orders moving through the shock and came out with a usable supply base.",
      rough: "Deliveries stabilized late, and margins and customer trust took visible damage.",
      collapse: "The shortage outlasted your cash, and the business shrank while it waited for supply."
    }
  },
  {
    id: "founder-runway",
    number: "04",
    category: "Sales & Revenue",
    era: "2023 • Startup economy",
    difficulty: "Founder mode",
    minutes: 6,
    title: "The Runway Test",
    hook: "You have a good product and exactly four months of cash.",
    story: "Your fictional software startup has enthusiastic users but uneven conversion to paid plans. A lender offers a costly growth loan. Your team expects you to lead through the uncertainty.",
    inspiration: "A composite scenario informed by common startup funding and monetization challenges, not a real company's result.",
    takeaway: "Runway buys time to prove the business, not a substitute for proof. Paying customers are the evidence that investors and your next decision both need.",
    driver: { min: 2, max: 7, evidenceIndex: 1, suffix: "%", shiftWhen: "atLeast", threshold: 5 },
    evidence: [
      { label: "Runway", value: "4 mo", note: "at current burn" },
      { label: "Paying users", value: "3.2%", note: "of active accounts" },
      { label: "Growth loan", value: "19%", note: "annual interest" }
    ],
    stages: [
      {
        prompt: "What is your first move?",
        options: [
          { id: "borrow", label: "Take the loan and buy growth", detail: "Double marketing spend and push hard on acquisition.", risk: "High risk", delta: -350, tags: ["debt", "growth"], links: [], profile: { riskAppetite: 2, successMetric: -2, rootCause: -2, timeHorizon: -1 }, outcome: "You took the loan and doubled marketing, and acquisition spiked while too few customers converted to cover the debt.", shifted: { delta: 220, outcome: "Customers were already paying, so the acquisition spending turned into revenue that covered the loan's cost." } },
          { id: "cut", label: "Cut expenses and extend runway", detail: "Pause nonessential hiring and focus the roadmap.", risk: "Lower risk", delta: 60, tags: ["lean"], links: [], profile: { leadership: 1, commitment: 1, successMetric: 1 }, outcome: "You cut expenses and extended runway, which bought time but left the conversion problem untouched." },
          { id: "presell", label: "Pre-sell to ten committed customers", detail: "Trade a custom onboarding sprint for revenue and feedback.", risk: "Balanced", delta: 150, tags: ["customers"], links: [], profile: { decisionStyle: 2, valueSignal: 2, rootCause: 2, leadership: 1 }, outcome: "You pre-sold to ten committed customers, and their early contracts revealed why people actually paid." }
        ]
      },
      {
        setup: "Your early customers want features the roadmap does not have. Two of them ask whether they can pay for a pilot.",
        prompt: "How do you respond to the feature requests?",
        options: [
          { id: "build-feature", label: "Build the requested features", detail: "Rebuild the roadmap around whatever the loudest users ask for.", risk: "High risk", delta: -90, tags: ["roadmap"], links: [{ tag: "debt", amount: -40, note: "Borrowed money for features nobody has paid for is a bad mix." }, { tag: "customers", amount: 110, note: "Pre-paying customers expect exactly the features they asked for." }], profile: { riskAppetite: 2, concentration: -1, rootCause: -1 }, outcome: "You rebuilt the roadmap around the loudest requests, and the product lost focus before anyone paid for it." },
          { id: "paid-pilot", label: "Sell a paid pilot to the two customers", detail: "Charge for the feature in exchange for their feedback.", risk: "Balanced", delta: 40, tags: ["customers"], links: [], profile: { valueSignal: 2, decisionStyle: 1, rootCause: 1 }, outcome: "The two paid pilots funded a small build, and their feedback shaped the feature before the roadmap changed." },
          { id: "decline-feature", label: "Decline and keep the current roadmap", detail: "Say no to the requests and protect the team's focus.", risk: "Lower risk", delta: 30, tags: ["lean"], links: [{ tag: "lean", amount: 50, note: "A lean team protects the roadmap while cutting costs." }, { tag: "customers", amount: -80, note: "Pre-paid customers are left waiting for the features they bought." }], profile: { commitment: 1, leadership: -1, valueSignal: -1 }, outcome: "You declined and kept the roadmap, which protected focus but left two willing buyers without an answer." }
        ]
      },
      {
        setup: "A competitor just cut its price by 20 percent. Sales conversations are going well, but onboarding is overloaded.",
        prompt: "How do you price the product?",
        options: [
          { id: "match-price", label: "Match the competitor's price", detail: "Cut your price to hold the same share of new buyers.", risk: "High risk", delta: -130, tags: ["discount"], links: [{ tag: "lean", amount: 160, note: "A lean cost base can survive a price cut." }, { tag: "debt", amount: -70, note: "Price cuts on borrowed money burn the cash too fast." }], profile: { riskAppetite: 1, valueSignal: -2, socialProof: -1 }, outcome: "Matching the competitor's price brought in buyers, but margins shrank before onboarding could absorb the load." },
          { id: "tier-plan", label: "Launch a tiered plan", detail: "Offer a cheaper entry tier with clear limits and an upgrade path.", risk: "Balanced", delta: 60, tags: ["value"], links: [{ tag: "customers", amount: 40, note: "Existing paying customers already know the value, so an upgrade path sells." }], profile: { decisionStyle: 1, valueSignal: 2, leadership: 1 }, outcome: "A cheaper entry tier with clear limits kept price-sensitive buyers talking, and upgrades carried the revenue." },
          { id: "hold-price", label: "Hold the price and sell the value", detail: "Keep the price and focus on proof, not discounting.", risk: "Lower risk", delta: 110, tags: ["value"], links: [{ tag: "customers", amount: 230, note: "Customers who already pay are proof the price is right." }], profile: { valueSignal: 2, commitment: 1, successMetric: 1 }, outcome: "You held the price and sold the value you had proven, which kept revenue steady and margins healthy." }
        ]
      },
      {
        setup: "A few months of runway remain. The team needs one measurable milestone to aim for before the next raise.",
        prompt: "What is your milestone target?",
        options: [
          { id: "user-milestone", label: "Hit a total-user number", detail: "Aim for a headline count of signups before the raise.", risk: "High risk", delta: -80, tags: ["growth"], links: [{ tag: "debt", amount: -130, note: "A signup target won't cover loan interest." }, { tag: "value", amount: -50, note: "Headline signups don't prove people will pay." }], profile: { successMetric: -2, riskAppetite: 1, socialProof: 1 }, outcome: "You aimed at a headline user count, and the number looked good until investors asked how many would stay." },
          { id: "retention-target", label: "Target retention and paid conversion", detail: "Set a goal for customers who stay and pay every month.", risk: "Balanced", delta: 90, tags: ["value"], links: [{ tag: "customers", amount: 40, note: "Paying customers make retention and conversion easy to measure." }], profile: { successMetric: 2, decisionStyle: 2, valueSignal: 1 }, outcome: "A retention and paid-conversion target gave the team one measurable aim, and the raise closed on that evidence." },
          { id: "profit-target", label: "Target breakeven on current revenue", detail: "Set a goal to cover costs before the raise, even if growth slows.", risk: "Lower risk", delta: 60, tags: ["lean"], links: [{ tag: "lean", amount: 60, note: "A lean team can reach breakeven on current revenue." }], profile: { timeHorizon: 1, commitment: 1, riskAppetite: -1 }, outcome: "A breakeven target protected the runway, although it slowed growth and made the raise harder to sell." }
        ]
      }
    ],
    verdicts: {
      strong: "You proved the product, the price, and the paying customers, and the company grew on evidence.",
      steady: "You bought time and built enough proof to make the next raise a real option.",
      rough: "The runway lasted, but the company reached the raise with its conversion problem still open.",
      collapse: "The loan outran conversion, and the company ran out of cash before the proof arrived."
    }
  },
  {
    id: "inflation-trap",
    number: "05",
    category: "Investing & Capital",
    era: "1970s • Economic cycles",
    difficulty: "Boss level",
    minutes: 6,
    title: "The Inflation Trap",
    hook: "Prices keep rising. Everyone has a hot tip. Nobody has a crystal ball.",
    story: "You're the fictional manager of a small family investment fund during an inflationary decade. Clients have different timelines: some need their money within a few years, others plan decades ahead. Cash, commodities, and businesses each carry different risks.",
    inspiration: "Inspired by the inflation challenges of the 1970s. Returns and case figures are hypothetical and are not historical market data or investment advice.",
    takeaway: "Inflation punishes both the wrong risk and no risk. Match each client's timeline and buffer, and let earlier choices set what each later move can afford.",
    driver: { min: 1, max: 10, evidenceIndex: 2, suffix: " yrs", shiftWhen: "below", threshold: 4 },
    evidence: [
      { label: "Inflation", value: "9%", note: "scenario assumption" },
      { label: "Cash yield", value: "4%", note: "below inflation" },
      { label: "Client horizon", value: "7 yrs", note: "before major spending" }
    ],
    stages: [
      {
        prompt: "How do you allocate the portfolio?",
        options: [
          { id: "lever", label: "Borrow and bet on one commodity", detail: "Concentrate the whole portfolio in the hottest trade.", risk: "Very high risk", delta: -420, tags: ["leverage", "concentrated"], links: [], profile: { concentration: -2, riskAppetite: 2, socialProof: -2, timeHorizon: -1 }, outcome: "You borrowed to bet on one commodity, and the price whipsaw forced a sale before the thesis could play out." },
          { id: "cash", label: "Stay entirely in cash", detail: "Avoid market losses until the economy settles.", risk: "Lower risk", delta: -130, tags: ["liquid"], links: [], profile: { riskAppetite: -2, timeHorizon: -1, valueSignal: -1 }, outcome: "You stayed in cash, so the balance held still while purchasing power eroded.", shifted: { delta: 140, outcome: "Clients needed the money within a few years, so keeping its value stable beat chasing growth." } },
          { id: "basket", label: "Build a diversified, liquid basket", detail: "Spread exposure and reserve liquidity for surprises.", risk: "Balanced", delta: 80, tags: ["diversified"], links: [], profile: { concentration: 2, timeHorizon: 2, decisionStyle: 2, successMetric: 1 }, outcome: "You built a diversified, liquid basket that held up through the shock and kept your options open." }
        ]
      },
      {
        setup: "A client asks for early access to funds to cover an urgent expense, and the bond market is moving against your holdings.",
        prompt: "How do you handle the client's request?",
        options: [
          { id: "sell-holdings", label: "Sell holdings at a loss to pay now", detail: "Raise the cash immediately, even at a poor price.", risk: "High risk", delta: -110, tags: ["forced"], links: [{ tag: "leverage", amount: -100, note: "Forced sales hit leveraged positions first." }, { tag: "liquid", amount: 180, note: "Liquid cash covers the request without a loss." }], profile: { riskAppetite: 1, leadership: -1, valueSignal: -1 }, outcome: "You sold holdings at a loss to meet the client's need now, locking in damage the portfolio did not need." },
          { id: "reserve-loan", label: "Offer a reserve-backed loan", detail: "Lend against a liquidity reserve set aside for exactly this.", risk: "Balanced", delta: 10, tags: ["liquid"], links: [{ tag: "diversified", amount: 40, note: "A diversified book keeps the reserve loan small." }], profile: { leadership: 2, decisionStyle: 1, rootCause: 1 }, outcome: "A reserve-backed loan covered the expense without forced sales, and the client trusted the plan more." },
          { id: "ask-wait", label: "Ask the client to wait", detail: "Delay the request and hope the bond market recovers.", risk: "Lower risk", delta: -80, tags: ["patient"], links: [{ tag: "leverage", amount: -60, note: "A leveraged book can't afford to wait." }], profile: { commitment: -1, leadership: -1, timeHorizon: -1 }, outcome: "Asking the client to wait preserved the holdings, but it strained a relationship that needed trust." }
        ]
      },
      {
        setup: "Gold prices are falling fast, and a rival fund publicly bets against the same assets your clients hold.",
        prompt: "Do you adjust exposure?",
        options: [
          { id: "buy-dip", label: "Buy the dip aggressively", detail: "Add exposure while prices are low and the rival may be wrong.", risk: "High risk", delta: 150, tags: ["aggressive"], links: [{ tag: "leverage", amount: -60, note: "Leverage has no room for more buying, and margin calls come first." }, { tag: "liquid", amount: 210, note: "Liquid cash gives you room to buy the dip." }], profile: { riskAppetite: 2, valueSignal: 1, socialProof: -1 }, outcome: "You bought the dip aggressively, and the rebound rewarded the move, though it stretched the portfolio thin." },
          { id: "inflation-bonds", label: "Shift into inflation-linked bonds", detail: "Move part of the portfolio toward assets that track inflation.", risk: "Balanced", delta: 100, tags: ["hedged"], links: [{ tag: "diversified", amount: 40, note: "A diversified book pairs well with inflation-linked bonds." }], profile: { decisionStyle: 2, valueSignal: 1, concentration: 1 }, outcome: "Inflation-linked bonds protected part of the portfolio, and clients' purchasing power held up better." },
          { id: "hold-all", label: "Hold every position", detail: "Ignore the noise and keep the allocation unchanged.", risk: "Lower risk", delta: -90, tags: ["patient"], links: [{ tag: "concentrated", amount: -120, note: "A concentrated portfolio holds the loss with no cover." }, { tag: "diversified", amount: 220, note: "A diversified book absorbs a fall in any single asset." }], profile: { commitment: -1, socialProof: 1, decisionStyle: -1 }, outcome: "You held every position through the noise, and the falling prices kept the portfolio exposed to the same trend." }
        ]
      },
      {
        setup: "Inflation is still high, and the fund must report to its investors. Each client's timeline is different.",
        prompt: "What is the long-term plan?",
        options: [
          { id: "high-yield", label: "Chase high yields for everyone", detail: "Aim for the best returns across every client, regardless of timeline.", risk: "High risk", delta: -120, tags: ["aggressive"], links: [{ tag: "aggressive", amount: 250, note: "Aggressive positions earn the yield they promised." }, { tag: "liquid", amount: -60, note: "Clients who need cash soon can't wait out a high-yield bet." }], profile: { riskAppetite: 2, timeHorizon: -2, socialProof: -1 }, outcome: "You chased high yields for every client, and the clients with short timelines found the risk too late." },
          { id: "balanced-buffer", label: "Match each client to a timeline and buffer", detail: "Sort clients by when they need money and fit a buffer to each.", risk: "Balanced", delta: 50, tags: ["hedged"], links: [{ tag: "diversified", amount: 60, note: "A diversified book fits a buffer for each client." }], profile: { timeHorizon: 2, decisionStyle: 2, concentration: 1 }, outcome: "You matched each client to a timeline and a buffer, so every portfolio fit its owner's needs." },
          { id: "short-deposits", label: "Move everything to short deposits", detail: "Keep all money in short, safe deposits until inflation fades.", risk: "Lower risk", delta: -90, tags: ["liquid"], links: [{ tag: "liquid", amount: 70, note: "Short deposits fit clients who kept their money liquid." }, { tag: "aggressive", amount: -270, note: "Short deposits waste the risk an aggressive book already took." }], profile: { riskAppetite: -2, timeHorizon: -1, valueSignal: -1 }, outcome: "Moving everything to short deposits kept the money safe, but it could not outrun the inflation it was meant to beat." }
        ]
      }
    ],
    verdicts: {
      strong: "You kept the clients' purchasing power intact and matched each portfolio to its owner's timeline.",
      steady: "You protected most client value and avoided the worst mistakes of a hard decade.",
      rough: "Your decisions cost some client value, and the fund recovered more slowly than it should.",
      collapse: "The leveraged bet and the forced sales wiped out most of the client value in the fund."
    }
  },

];

export const RECOVERY_QUESTIONS = [
  {
    prompt: "Which action reduces dependence on one supplier?",
    options: ["Borrow to stockpile", "Qualify another supplier", "Ignore delivery risk"],
    correct: 1
  },
  {
    prompt: "A startup has fast user growth but no paying customers. What should it check first?",
    options: ["Unit economics and conversion", "Its logo color", "How many ads it can buy"],
    correct: 0
  }
];
