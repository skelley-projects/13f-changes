export interface SegmentPlayer {
  name: string;
  ticker?: string;
  role: string;
  kind?: 'Public' | 'Private' | 'ETF';
}

export interface SegmentPrimer {
  summary: string;
  overview: string[];
  marketMap: string[];
  watchItems: string[];
  majorPlayers: SegmentPlayer[];
}

const aiClusterPrimer = (summary: string, marketMap: string[], watchItems: string[], majorPlayers: SegmentPlayer[]): SegmentPrimer => ({
  summary,
  overview: [
    'This segment sits inside the physical and semiconductor supply chain that supports AI training and inference. The important question is not only whether AI demand grows, but where scarcity shows up: chips, memory, networking, power, sites, or specialized services.',
    'For 13F analysis, the tag is meant to separate the specific bottleneck a company is exposed to from the broad AI label. That helps distinguish a direct accelerator supplier from a power-equipment company, a data center landlord, or a miner with a power portfolio that could be repurposed for HPC.'
  ],
  marketMap,
  watchItems,
  majorPlayers,
});

const consumerPrimer = (summary: string, marketMap: string[], watchItems: string[], majorPlayers: SegmentPlayer[]): SegmentPrimer => ({
  summary,
  overview: [
    'This segment captures consumer demand expressed through platforms, brands, distribution, or recurring purchase behavior. The same 13F dollar move can mean very different things depending on whether the company is a scaled platform, a cyclical retailer, or a defensive staples compounder.',
    'The main analytical job is to separate structural share gain from cyclical volume, pricing, margin, or advertising swings. Granular tagging makes it easier to see whether a fund is leaning into consumer platforms, reopening/cyclical exposure, staples durability, or housing-linked demand.'
  ],
  marketMap,
  watchItems,
  majorPlayers,
});

const healthPrimer = (summary: string, marketMap: string[], watchItems: string[], majorPlayers: SegmentPlayer[]): SegmentPrimer => ({
  summary,
  overview: [
    'This segment groups health-care businesses by the economic engine behind the exposure: discovery tools, drug development, scaled pharma manufacturing, or patient-service delivery. The risk profile changes sharply across those layers.',
    'For 13F readers, the tag helps separate long-duration clinical optionality from cash-flowing service or product businesses. It also makes it easier to see when a fund is taking scientific risk versus reimbursement, utilization, or platform-consolidation risk.'
  ],
  marketMap,
  watchItems,
  majorPlayers,
});

const industrialPrimer = (summary: string, marketMap: string[], watchItems: string[], majorPlayers: SegmentPlayer[]): SegmentPrimer => ({
  summary,
  overview: [
    'This segment covers real-economy businesses where orders, capacity, commodity prices, and capital spending cycles matter. Reported holdings can look old-economy on the surface while still expressing a view on electrification, reshoring, infrastructure, defense, or AI-related power demand.',
    'The useful split is between volume cycle, pricing power, asset scarcity, and equipment replacement. A fund adding to the tag may be making a macro call, a bottleneck call, or a company-specific operating leverage call.'
  ],
  marketMap,
  watchItems,
  majorPlayers,
});

const financialPrimer = (summary: string, marketMap: string[], watchItems: string[], majorPlayers: SegmentPlayer[]): SegmentPrimer => ({
  summary,
  overview: [
    'This segment captures financial exposure where rates, credit quality, market activity, regulation, and deposit or funding costs drive earnings. The companies can look similar in sector screens while having very different sensitivities.',
    'Granular tagging helps separate balance-sheet lenders from fee-based market infrastructure and fintech platforms. That distinction matters because a higher-rate or risk-on environment can help one group while pressuring another.'
  ],
  marketMap,
  watchItems,
  majorPlayers,
});

const marketPrimer = (summary: string, marketMap: string[], watchItems: string[], majorPlayers: SegmentPlayer[]): SegmentPrimer => ({
  summary,
  overview: [
    'This segment is less about single-company selection and more about broad market, factor, or geographic exposure. In a 13F, ETF positions can show whether a fund is adding beta, hedging, expressing country views, or parking exposure while rotating single names.',
    'The read-through is portfolio-level: size, direction, and timing usually matter more than issuer-level fundamentals. These rows should be interpreted alongside the fund\'s single-name activity rather than as operating-company bets.'
  ],
  marketMap,
  watchItems,
  majorPlayers,
});

export const segmentPrimers: Record<string, SegmentPrimer> = {
  'photonics': aiClusterPrimer(
    'Optical components and silicon photonics move data between chips, servers, and data centers. As AI clusters scale, bandwidth and power efficiency become constraints, which puts transceivers, lasers, DSPs, and optical packaging in the spotlight.',
    ['Optical transceivers and modules', 'Lasers, modulators, and photonic integrated circuits', 'Switching, routing, and interconnect systems', 'Foundry and packaging partners'],
    ['800G/1.6T adoption', 'Hyperscaler capex and AI cluster density', 'Margin pressure from rapid product transitions', 'Whether silicon photonics shifts value from modules to integrated platforms'],
    [
      { name: 'Coherent', ticker: 'COHR', role: 'Optical materials, lasers, and transceiver components' },
      { name: 'Lumentum', ticker: 'LITE', role: 'Lasers, optical components, and datacom exposure' },
      { name: 'Broadcom', ticker: 'AVGO', role: 'Networking silicon and co-packaged optics adjacency' },
      { name: 'Marvell', ticker: 'MRVL', role: 'DSPs, optical interconnect silicon, and custom silicon' },
      { name: 'Cisco', ticker: 'CSCO', role: 'Networking systems and optics' },
      { name: 'Nvidia', ticker: 'NVDA', role: 'AI systems increasingly tied to networking and optics' },
    ]
  ),
  'hbm-memory': aiClusterPrimer(
    'High-bandwidth memory is stacked DRAM packaged close to accelerators so GPUs can feed models fast enough. It is one of the most visible AI hardware bottlenecks because capacity, yield, and advanced packaging all have to scale together.',
    ['DRAM/HBM manufacturers', 'Advanced packaging and substrate suppliers', 'Memory controllers and platform qualification', 'Equipment and materials used in memory production'],
    ['HBM capacity additions', 'Pricing and contract duration', 'Yield on newer HBM generations', 'Customer qualification with Nvidia, AMD, and hyperscaler ASIC programs'],
    [
      { name: 'SK Hynix', role: 'Leading HBM supplier', kind: 'Public' },
      { name: 'Samsung Electronics', role: 'Memory and foundry scale player', kind: 'Public' },
      { name: 'Micron Technology', ticker: 'MU', role: 'US DRAM and HBM supplier' },
      { name: 'Nvidia', ticker: 'NVDA', role: 'Key HBM demand driver through AI accelerators' },
      { name: 'AMD', ticker: 'AMD', role: 'AI accelerator customer for HBM' },
      { name: 'TSMC', ticker: 'TSM', role: 'Advanced packaging partner for AI accelerators' },
    ]
  ),
  'ai-foundries': aiClusterPrimer(
    'Leading-edge foundries fabricate the most advanced AI chips and package them into increasingly complex systems. The segment is about manufacturing scarcity, process leadership, and advanced packaging capacity rather than model software itself.',
    ['Leading-edge wafer fabrication', 'Advanced packaging such as CoWoS-like capacity', 'EDA/IP and mask ecosystem', 'Large fab capex and geopolitical supply chain risk'],
    ['Utilization at advanced nodes', 'Packaging bottlenecks', 'Customer concentration in AI accelerators', 'Export controls and regional fab incentives'],
    [
      { name: 'TSMC', ticker: 'TSM', role: 'Dominant leading-edge foundry' },
      { name: 'Samsung Electronics', role: 'Memory and advanced foundry competitor', kind: 'Public' },
      { name: 'Intel Foundry', ticker: 'INTC', role: 'US-based leading-edge foundry effort' },
      { name: 'GlobalFoundries', ticker: 'GFS', role: 'Specialty and mature-node foundry' },
      { name: 'UMC', ticker: 'UMC', role: 'Mature-node foundry' },
    ]
  ),
  'ai-foundry': aiClusterPrimer(
    'Leading-edge foundry exposure is a direct way to express demand for AI silicon without owning only the chip designers. The economics depend on node leadership, advanced packaging, capex intensity, and customer allocation.',
    ['Advanced-node manufacturing', 'Advanced packaging', 'Large fab equipment ecosystems', 'Geopolitical diversification of fabs'],
    ['AI chip wafer starts', 'Packaging lead times', 'Capex discipline', 'Customer mix across Nvidia, AMD, Apple, and custom ASIC programs'],
    [
      { name: 'TSMC', ticker: 'TSM', role: 'Dominant leading-edge foundry' },
      { name: 'Samsung Electronics', role: 'Advanced logic and memory scale player', kind: 'Public' },
      { name: 'Intel Foundry', ticker: 'INTC', role: 'US leading-edge foundry strategy' },
      { name: 'GlobalFoundries', ticker: 'GFS', role: 'Specialty/mature foundry capacity' },
      { name: 'UMC', ticker: 'UMC', role: 'Mature-node foundry capacity' },
    ]
  ),
  'gpu-accelerator': aiClusterPrimer(
    'GPU and accelerator companies design the chips that train and run AI models. This is the most direct AI compute exposure, but it also carries product-cycle, customer concentration, supply, and valuation risk.',
    ['Merchant GPUs and accelerators', 'Custom ASIC programs', 'Networking and software platforms around accelerators', 'Server OEM and ODM integration'],
    ['Accelerator generation transitions', 'Hyperscaler capex mix', 'Gross margin sustainability', 'Custom ASIC substitution risk'],
    [
      { name: 'Nvidia', ticker: 'NVDA', role: 'Dominant AI accelerator platform' },
      { name: 'AMD', ticker: 'AMD', role: 'Merchant GPU and accelerator competitor' },
      { name: 'Broadcom', ticker: 'AVGO', role: 'Custom AI ASIC and networking silicon' },
      { name: 'Marvell', ticker: 'MRVL', role: 'Custom silicon and data infrastructure' },
      { name: 'Intel', ticker: 'INTC', role: 'CPU platform and accelerator efforts' },
      { name: 'Google', ticker: 'GOOGL', role: 'Internal TPU platform and cloud AI demand' },
    ]
  ),
  'nuclear-power': industrialPrimer(
    'Nuclear power exposure is tied to the search for reliable, carbon-light baseload power for data centers and broader electrification. The segment includes existing plant owners, uranium/fuel-cycle exposure, and newer reactor developers.',
    ['Regulated and merchant nuclear generation', 'Uranium and fuel-cycle supply', 'Small modular reactor development', 'Power purchase agreements with large load customers'],
    ['Restart and life-extension approvals', 'PPA pricing and duration', 'Uranium/fuel availability', 'Whether SMR projects move from narrative to financed deployment'],
    [
      { name: 'Constellation Energy', ticker: 'CEG', role: 'Large US nuclear fleet owner' },
      { name: 'Vistra', ticker: 'VST', role: 'Power generator with nuclear exposure' },
      { name: 'Cameco', ticker: 'CCJ', role: 'Uranium and nuclear fuel-cycle exposure' },
      { name: 'BWX Technologies', ticker: 'BWXT', role: 'Nuclear components and services' },
      { name: 'GE Vernova', ticker: 'GEV', role: 'Power equipment and nuclear technology exposure' },
      { name: 'NuScale Power', ticker: 'SMR', role: 'SMR development exposure' },
    ]
  ),
  'gas-peakers-nat-gas-e-and-p': industrialPrimer(
    'Gas peakers and natural-gas producers sit behind dispatchable power demand. In the AI data center framing, they matter because large loads need reliability before the grid has enough transmission and clean baseload capacity.',
    ['Natural gas E&P', 'Gas-fired generation and peakers', 'Midstream and takeaway capacity', 'Power contracts for large-load customers'],
    ['Henry Hub and regional basis spreads', 'Permitting and interconnection timelines', 'Capacity market pricing', 'How much AI load is served by dedicated gas generation'],
    [
      { name: 'EQT', ticker: 'EQT', role: 'Large US natural gas producer' },
      { name: 'Cheniere Energy', ticker: 'LNG', role: 'LNG export and gas demand linkage' },
      { name: 'Kinder Morgan', ticker: 'KMI', role: 'Gas pipeline infrastructure' },
      { name: 'Williams', ticker: 'WMB', role: 'Gas transmission and midstream' },
      { name: 'Vistra', ticker: 'VST', role: 'Power generation with gas fleet exposure' },
      { name: 'NRG Energy', ticker: 'NRG', role: 'Retail power and generation' },
    ]
  ),
  'grid-hardware': industrialPrimer(
    'Grid hardware covers the physical equipment needed to connect new power demand: transformers, switchgear, breakers, substations, and transmission components. It is a bottleneck segment because lead times can be long and utility capex is rising.',
    ['Transformers and switchgear', 'Substation equipment', 'Transmission and distribution components', 'Grid automation and protection systems'],
    ['Backlog duration and pricing', 'Utility capex cycles', 'Transformer shortages', 'Domestic manufacturing incentives'],
    [
      { name: 'Eaton', ticker: 'ETN', role: 'Electrical equipment and power management' },
      { name: 'Schneider Electric', role: 'Electrical distribution and automation', kind: 'Public' },
      { name: 'ABB', ticker: 'ABBNY', role: 'Grid automation and electrification equipment' },
      { name: 'Siemens Energy', role: 'Grid technology and power equipment', kind: 'Public' },
      { name: 'GE Vernova', ticker: 'GEV', role: 'Grid and power equipment' },
      { name: 'Hubbell', ticker: 'HUBB', role: 'Utility and electrical infrastructure components' },
    ]
  ),
  'datacenter-reits': aiClusterPrimer(
    'Data center REITs own and lease critical real estate, power, and interconnection capacity. They are not pure AI software bets; they are infrastructure landlords whose economics depend on capacity scarcity, power access, renewal spreads, and tenant quality.',
    ['Wholesale and retail colocation', 'Interconnection-rich campuses', 'Power procurement and development pipelines', 'Long-term leases with cloud and enterprise customers'],
    ['Leasing spreads', 'Power availability by market', 'Development yields', 'Tenant concentration and hyperscaler bargaining power'],
    [
      { name: 'Equinix', ticker: 'EQIX', role: 'Global interconnection and colocation REIT' },
      { name: 'Digital Realty', ticker: 'DLR', role: 'Global data center REIT' },
      { name: 'Iron Mountain', ticker: 'IRM', role: 'Data center and storage-adjacent REIT exposure' },
      { name: 'American Tower', ticker: 'AMT', role: 'Communications infrastructure with data center adjacency' },
      { name: 'CyrusOne', role: 'Private data center operator', kind: 'Private' },
    ]
  ),
  'fuel-cells': industrialPrimer(
    'Fuel cells convert fuel into electricity through an electrochemical process. For data centers, the appeal is distributed, potentially lower-emission power that can sit closer to load than new transmission-heavy projects.',
    ['Stationary fuel-cell systems', 'Hydrogen production and handling', 'Distributed power projects', 'Service and maintenance contracts'],
    ['Project economics versus grid power and gas turbines', 'Hydrogen availability and cost', 'Customer concentration', 'Warranty, reliability, and financing terms'],
    [
      { name: 'Bloom Energy', ticker: 'BE', role: 'Stationary fuel-cell power systems' },
      { name: 'Plug Power', ticker: 'PLUG', role: 'Hydrogen and fuel-cell systems' },
      { name: 'FuelCell Energy', ticker: 'FCEL', role: 'Fuel-cell power plants' },
      { name: 'Ballard Power Systems', ticker: 'BLDP', role: 'Fuel-cell modules, especially mobility' },
      { name: 'Cummins', ticker: 'CMI', role: 'Power systems and hydrogen adjacency' },
    ]
  ),
  'power-equipment': industrialPrimer(
    'Power equipment includes generators, engines, boilers, turbines, and integrated systems used to serve new load. It is a picks-and-shovels segment for electrification and AI power demand.',
    ['Backup and prime generators', 'Gas turbines and engines', 'Boilers and thermal systems', 'Service, parts, and controls'],
    ['Order backlog and delivery lead times', 'Data center customer mix', 'Margin on equipment versus service', 'Regulatory treatment of backup generation'],
    [
      { name: 'GE Vernova', ticker: 'GEV', role: 'Gas turbines, grid, and power systems' },
      { name: 'Caterpillar', ticker: 'CAT', role: 'Engines and generators' },
      { name: 'Cummins', ticker: 'CMI', role: 'Generators and power systems' },
      { name: 'Power Solutions International', ticker: 'PSIX', role: 'Engines and power systems' },
      { name: 'Babcock & Wilcox', ticker: 'BW', role: 'Boilers and thermal power equipment' },
    ]
  ),
  'oilfield-power-services': industrialPrimer(
    'Oilfield power services links energy-service capacity with power, gas, and industrial infrastructure demand. These companies can benefit when pressure pumping, distributed power, gas production, or field electrification are tight.',
    ['Pressure pumping and completion services', 'Distributed power for field operations', 'Gas processing and infrastructure services', 'Equipment rental and maintenance'],
    ['E&P capex discipline', 'Utilization and pricing for service fleets', 'Natural-gas activity levels', 'Whether data center power demand creates new non-oilfield revenue streams'],
    [
      { name: 'Liberty Energy', ticker: 'LBRT', role: 'Pressure pumping and energy services' },
      { name: 'ProPetro', ticker: 'PUMP', role: 'Hydraulic fracturing and oilfield services' },
      { name: 'Solaris Energy Infrastructure', ticker: 'SEI', role: 'Distributed power and proppant/logistics adjacency' },
      { name: 'Halliburton', ticker: 'HAL', role: 'Global oilfield services' },
      { name: 'SLB', ticker: 'SLB', role: 'Global oilfield technology and services' },
    ]
  ),
  'accelerated-cloud': aiClusterPrimer(
    'Accelerated cloud providers rent GPU capacity and AI infrastructure to model builders, enterprises, and developers. The business sits between chip supply, power/site availability, financing, and customer demand for training and inference.',
    ['GPU cloud and bare-metal AI compute', 'Managed training/inference platforms', 'Long-term capacity contracts', 'Financing for GPU fleets and data center capacity'],
    ['Utilization of GPU clusters', 'Customer concentration', 'Debt and lease financing terms', 'Whether hyperscalers internalize more demand'],
    [
      { name: 'CoreWeave', ticker: 'CRWV', role: 'GPU cloud and AI infrastructure platform' },
      { name: 'Nebius', ticker: 'NBIS', role: 'AI cloud infrastructure' },
      { name: 'Lambda', role: 'Private GPU cloud provider', kind: 'Private' },
      { name: 'Microsoft Azure', ticker: 'MSFT', role: 'Hyperscale cloud AI infrastructure' },
      { name: 'Amazon Web Services', ticker: 'AMZN', role: 'Hyperscale cloud AI infrastructure' },
      { name: 'Google Cloud', ticker: 'GOOGL', role: 'Hyperscale cloud and TPU infrastructure' },
    ]
  ),
  'ai-datacenter-hosting': aiClusterPrimer(
    'AI data center hosting covers operators that provide sites, power, and infrastructure for HPC or AI tenants. It overlaps with bitcoin miners because power portfolios and large sites can be repurposed toward compute hosting.',
    ['Powered shells and colocation', 'HPC hosting contracts', 'Power procurement and interconnection queues', 'Conversion of crypto-mining sites to AI/HPC'],
    ['Contract quality and counterparty risk', 'Power cost and uptime', 'Capex funding', 'How much hosting economics accrue to landlord versus compute provider'],
    [
      { name: 'Core Scientific', ticker: 'CORZ', role: 'Bitcoin miner and AI/HPC hosting pivot' },
      { name: 'IREN', ticker: 'IREN', role: 'Data center and bitcoin mining infrastructure' },
      { name: 'Applied Digital', ticker: 'APLD', role: 'HPC and AI data center development' },
      { name: 'TeraWulf', ticker: 'WULF', role: 'Power-linked mining and HPC hosting' },
      { name: 'Equinix', ticker: 'EQIX', role: 'Scaled colocation and interconnection' },
    ]
  ),
  'bitcoin-hpc-miners': aiClusterPrimer(
    'Bitcoin/HPC miners own power access, land, cooling, and operating know-how for dense compute. The thesis is that some mining infrastructure can migrate toward AI hosting, though execution, contract quality, and capex needs vary widely.',
    ['Bitcoin self-mining', 'Power and site portfolios', 'HPC/AI hosting conversions', 'Fleet financing and energy management'],
    ['Bitcoin price and hashprice', 'AI hosting contract terms', 'Power curtailment and grid programs', 'Dilution or debt needed to fund conversion capex'],
    [
      { name: 'Core Scientific', ticker: 'CORZ', role: 'Mining plus AI/HPC hosting contracts' },
      { name: 'IREN', ticker: 'IREN', role: 'Mining and data center infrastructure' },
      { name: 'CleanSpark', ticker: 'CLSK', role: 'Scaled bitcoin miner' },
      { name: 'Riot Platforms', ticker: 'RIOT', role: 'Large bitcoin miner with power assets' },
      { name: 'Cipher Mining', ticker: 'CIFR', role: 'Bitcoin miner with power/site optionality' },
      { name: 'TeraWulf', ticker: 'WULF', role: 'Power-linked mining and HPC optionality' },
    ]
  ),
  'storage-media': aiClusterPrimer(
    'Storage media covers HDD, NAND, and related storage suppliers. AI training and inference create enormous data flows, but the investable question is whether storage demand translates into pricing power, capacity discipline, and better mix.',
    ['Nearline hard drives', 'NAND flash and SSDs', 'Enterprise storage systems', 'Controllers, substrates, and supply-chain components'],
    ['Nearline HDD pricing', 'NAND supply discipline', 'Cloud capex mix', 'How much AI data retention drives incremental storage demand'],
    [
      { name: 'Western Digital', ticker: 'WDC', role: 'HDD and flash storage' },
      { name: 'Seagate', ticker: 'STX', role: 'Hard-drive storage' },
      { name: 'SanDisk', ticker: 'SNDK', role: 'Flash and NAND storage exposure' },
      { name: 'Micron Technology', ticker: 'MU', role: 'NAND and DRAM supplier' },
      { name: 'Samsung Electronics', role: 'Memory and storage supplier', kind: 'Public' },
    ]
  ),
  'platform-silicon': aiClusterPrimer(
    'Platform silicon includes CPUs, accelerators, and adjacent silicon that anchors compute platforms. It is broader than a pure GPU tag because CPUs, networking, memory controllers, and platform roadmaps shape the whole server stack.',
    ['Server CPUs and platform chipsets', 'Accelerator-adjacent silicon', 'Edge AI processors', 'Software ecosystems and developer platforms'],
    ['Data center CPU share shifts', 'Attach rates around AI servers', 'Foundry roadmap execution', 'Whether accelerators reduce or increase CPU platform value'],
    [
      { name: 'Intel', ticker: 'INTC', role: 'CPU platform and foundry strategy' },
      { name: 'AMD', ticker: 'AMD', role: 'Server CPUs and AI accelerators' },
      { name: 'Nvidia', ticker: 'NVDA', role: 'AI platform silicon and systems' },
      { name: 'Arm', ticker: 'ARM', role: 'CPU IP used across cloud and edge' },
      { name: 'Qualcomm', ticker: 'QCOM', role: 'Edge and mobile AI silicon' },
    ]
  ),
  'ai-networking-silicon': aiClusterPrimer(
    'AI networking silicon connects accelerators into clusters. As model sizes and inference traffic rise, switching, Ethernet, custom ASICs, NICs, and optical DSPs become central to performance and power efficiency.',
    ['Ethernet and InfiniBand switching', 'Custom ASICs', 'NICs and DPUs', 'Optical DSPs and interconnect controllers'],
    ['Ethernet versus InfiniBand mix', 'Custom ASIC wins', 'Co-packaged optics adoption', 'Cluster scale and east-west traffic growth'],
    [
      { name: 'Broadcom', ticker: 'AVGO', role: 'Switching, custom ASICs, and networking silicon' },
      { name: 'Marvell', ticker: 'MRVL', role: 'Custom silicon and optical DSPs' },
      { name: 'Nvidia', ticker: 'NVDA', role: 'InfiniBand, Ethernet, and AI networking systems' },
      { name: 'Cisco', ticker: 'CSCO', role: 'Networking systems and silicon adjacency' },
      { name: 'Arista Networks', ticker: 'ANET', role: 'Cloud networking systems' },
    ]
  ),
  'specialty-foundry': aiClusterPrimer(
    'Specialty foundries fabricate analog, RF, mixed-signal, power, and mature-node chips. They are less about leading-edge AI accelerators and more about the broad hardware ecosystem that surrounds servers, industrial electronics, and edge devices.',
    ['Analog and mixed-signal fabs', 'RF and power semiconductor processes', 'Mature-node capacity', 'Automotive, industrial, and communications demand'],
    ['Utilization on mature nodes', 'Pricing after supply shortages normalize', 'China capacity additions', 'Demand recovery in industrial and auto end markets'],
    [
      { name: 'GlobalFoundries', ticker: 'GFS', role: 'Specialty foundry' },
      { name: 'Tower Semiconductor', ticker: 'TSEM', role: 'Analog and specialty foundry' },
      { name: 'UMC', ticker: 'UMC', role: 'Mature-node foundry' },
      { name: 'Texas Instruments', ticker: 'TXN', role: 'Internal analog manufacturing scale' },
      { name: 'STMicroelectronics', ticker: 'STM', role: 'Power, analog, and mixed-signal semis' },
    ]
  ),
  'diagnostics-and-research': healthPrimer(
    'Diagnostics and research tools companies sell the instruments, tests, reagents, and data layers used to detect disease and conduct life-science research.',
    ['Clinical diagnostics and lab testing', 'Genetic testing and sequencing', 'Research tools and reagents', 'Lab automation and data platforms'],
    ['Research funding cycles', 'Test reimbursement', 'Sequencing adoption', 'Hospital and lab capital budgets'],
    [
      { name: 'Thermo Fisher Scientific', ticker: 'TMO', role: 'Life-science tools and lab equipment' },
      { name: 'Danaher', ticker: 'DHR', role: 'Diagnostics and life-science tools' },
      { name: 'Illumina', ticker: 'ILMN', role: 'Sequencing systems' },
      { name: 'Quest Diagnostics', ticker: 'DGX', role: 'Clinical lab testing' },
      { name: 'Labcorp', ticker: 'LH', role: 'Clinical labs and drug development services' },
      { name: 'Natera', ticker: 'NTRA', role: 'Genetic testing' },
    ]
  ),
  'therapeutics-biotech': healthPrimer(
    'Therapeutics biotech covers companies whose value is driven by drug pipelines, clinical data, commercial launches, or platform science.',
    ['Clinical-stage biotech', 'Commercial specialty biotech', 'Platform technologies', 'M&A and licensing markets'],
    ['Clinical trial readouts', 'FDA and reimbursement decisions', 'Cash runway', 'Large-pharma M&A appetite'],
    [
      { name: 'Amgen', ticker: 'AMGN', role: 'Large commercial biotech' },
      { name: 'Regeneron', ticker: 'REGN', role: 'Commercial biotech and drug discovery' },
      { name: 'Gilead Sciences', ticker: 'GILD', role: 'Biopharma with antiviral and oncology franchises' },
      { name: 'Vertex Pharmaceuticals', ticker: 'VRTX', role: 'Specialty biotech franchise' },
      { name: 'Moderna', ticker: 'MRNA', role: 'mRNA platform biotech' },
      { name: 'Alnylam', ticker: 'ALNY', role: 'RNAi therapeutics platform' },
    ]
  ),
  'pharma-generics': healthPrimer(
    'Pharma and generics exposure is more about manufacturing scale, product portfolios, pricing, legal risk, and balance sheets than early-stage science.',
    ['Generic drug manufacturing', 'Specialty pharma portfolios', 'Biosimilars', 'Distribution and supply reliability'],
    ['Pricing pressure', 'Patent cliffs and launches', 'Manufacturing quality issues', 'Leverage and litigation risk'],
    [
      { name: 'Teva Pharmaceutical', ticker: 'TEVA', role: 'Global generic and specialty pharma' },
      { name: 'Viatris', ticker: 'VTRS', role: 'Generics and legacy branded drugs' },
      { name: 'Sandoz', role: 'Generic and biosimilar medicines', kind: 'Public' },
      { name: 'Sun Pharma', role: 'Global specialty and generic pharma', kind: 'Public' },
      { name: 'Dr. Reddy\'s', ticker: 'RDY', role: 'Generics and specialty pharma' },
      { name: 'Hikma Pharmaceuticals', role: 'Injectables and generics', kind: 'Public' },
    ]
  ),
  'care-delivery': healthPrimer(
    'Care delivery companies operate the channels through which patients receive treatment: hospitals, clinics, home infusion, dialysis, fertility, and managed-service platforms.',
    ['Hospitals and ambulatory care', 'Home and specialty infusion', 'Dialysis and chronic care', 'Fertility and specialty clinics'],
    ['Utilization trends', 'Labor cost inflation', 'Reimbursement pressure', 'Payor mix and site-of-care shifts'],
    [
      { name: 'UnitedHealth Group', ticker: 'UNH', role: 'Managed care and care delivery through Optum' },
      { name: 'HCA Healthcare', ticker: 'HCA', role: 'Hospital operator' },
      { name: 'Tenet Healthcare', ticker: 'THC', role: 'Hospitals and ambulatory surgery centers' },
      { name: 'DaVita', ticker: 'DVA', role: 'Dialysis care' },
      { name: 'Option Care Health', ticker: 'OPCH', role: 'Home and alternate-site infusion' },
      { name: 'Progyny', ticker: 'PGNY', role: 'Fertility benefits and care navigation' },
    ]
  ),
  'e-commerce-marketplaces': consumerPrimer(
    'E-commerce marketplaces aggregate supply and demand online. The strongest models benefit from selection, logistics density, advertising, payments, and buyer trust.',
    ['First-party and third-party retail', 'Marketplace advertising', 'Delivery and logistics networks', 'Payments and seller services'],
    ['Gross merchandise volume growth', 'Ad take rate', 'Logistics cost per order', 'Competitive intensity from social commerce and discount platforms'],
    [
      { name: 'Amazon', ticker: 'AMZN', role: 'Global marketplace and logistics platform' },
      { name: 'MercadoLibre', ticker: 'MELI', role: 'Latin American marketplace and fintech ecosystem' },
      { name: 'Alibaba', ticker: 'BABA', role: 'China commerce and cloud platform' },
      { name: 'Shopify', ticker: 'SHOP', role: 'Merchant software and commerce infrastructure' },
      { name: 'DoorDash', ticker: 'DASH', role: 'Local delivery marketplace' },
      { name: 'Coupang', ticker: 'CPNG', role: 'Korean e-commerce and logistics platform' },
    ]
  ),
  'digital-media-and-apps': consumerPrimer(
    'Digital media and apps capture consumer attention through search, social, streaming, gaming, ticketing, and mobile services. Revenue is usually tied to advertising, subscriptions, transactions, or app-store economics.',
    ['Search and social platforms', 'Streaming and gaming', 'Ticketing and live events', 'App stores and mobile services'],
    ['Ad pricing and engagement', 'AI search disruption', 'Subscription churn', 'Regulatory pressure on platform fees and content'],
    [
      { name: 'Alphabet', ticker: 'GOOGL', role: 'Search, YouTube, and cloud platform' },
      { name: 'Meta Platforms', ticker: 'META', role: 'Social platforms and advertising' },
      { name: 'Netflix', ticker: 'NFLX', role: 'Streaming subscription platform' },
      { name: 'Spotify', ticker: 'SPOT', role: 'Audio streaming platform' },
      { name: 'Roblox', ticker: 'RBLX', role: 'Gaming and creator platform' },
      { name: 'Live Nation', ticker: 'LYV', role: 'Live events and ticketing' },
    ]
  ),
  'restaurants-and-staples': consumerPrimer(
    'Restaurants and staples combine recurring consumer demand with very different economics: restaurants are unit-growth and traffic stories, while staples depend more on brand strength, pricing, and distribution.',
    ['Quick-service and fast-casual restaurants', 'Grocery and food distribution', 'Tobacco and nicotine', 'Packaged foods and beverages'],
    ['Traffic versus price mix', 'Commodity and labor inflation', 'Brand elasticity', 'Private-label competition'],
    [
      { name: 'McDonald\'s', ticker: 'MCD', role: 'Global quick-service restaurant platform' },
      { name: 'Chipotle', ticker: 'CMG', role: 'Fast-casual restaurant growth' },
      { name: 'Costco', ticker: 'COST', role: 'Membership warehouse retail' },
      { name: 'Walmart', ticker: 'WMT', role: 'Scaled grocery and general merchandise' },
      { name: 'Philip Morris International', ticker: 'PM', role: 'Tobacco and reduced-risk products' },
      { name: 'PepsiCo', ticker: 'PEP', role: 'Snacks and beverages' },
    ]
  ),
  'housing-and-retail': consumerPrimer(
    'Housing and specialty retail exposure is tied to household formation, mortgage rates, repair/remodel spending, auto maintenance, and discretionary categories.',
    ['Homebuilders and building products', 'Housing marketplaces', 'Auto parts retail', 'Furniture, sporting goods, and specialty retail'],
    ['Mortgage rates and affordability', 'Existing-home turnover', 'Inventory levels', 'Consumer credit and discretionary spending'],
    [
      { name: 'D.R. Horton', ticker: 'DHI', role: 'Large US homebuilder' },
      { name: 'Lennar', ticker: 'LEN', role: 'Large US homebuilder' },
      { name: 'Home Depot', ticker: 'HD', role: 'Home improvement retail' },
      { name: 'Lowe\'s', ticker: 'LOW', role: 'Home improvement retail' },
      { name: 'AutoZone', ticker: 'AZO', role: 'Auto parts retail' },
      { name: 'Zillow', ticker: 'Z', role: 'Housing marketplace' },
    ]
  ),
  'financial-etfs': marketPrimer(
    'Financial ETFs give broad exposure to banks, insurers, brokers, asset managers, and capital-markets infrastructure without requiring a single-company call.',
    ['Large-cap financial-sector ETFs', 'Regional bank ETFs', 'Insurance and broker exposure', 'Factor and equal-weight sector products'],
    ['Yield curve shape', 'Credit losses', 'Capital markets activity', 'Regulatory capital and bank deposit trends'],
    [
      { name: 'Financial Select Sector SPDR', ticker: 'XLF', role: 'Large US financials ETF', kind: 'ETF' },
      { name: 'SPDR S&P Regional Banking ETF', ticker: 'KRE', role: 'Regional bank ETF', kind: 'ETF' },
      { name: 'iShares U.S. Financials ETF', ticker: 'IYF', role: 'US financials ETF', kind: 'ETF' },
      { name: 'Vanguard Financials ETF', ticker: 'VFH', role: 'Broad financials ETF', kind: 'ETF' },
    ]
  ),
  'banks-and-credit': financialPrimer(
    'Banks and credit companies earn through lending, deposits, cards, brokerage sweep balances, and credit spreads. The segment is highly sensitive to funding costs and credit normalization.',
    ['Money-center and regional banks', 'Card lenders and consumer finance', 'Brokerage and wealth platforms', 'Insurance distribution and credit services'],
    ['Net interest margin', 'Deposit beta and funding mix', 'Credit losses', 'Capital returns and regulatory constraints'],
    [
      { name: 'JPMorgan Chase', ticker: 'JPM', role: 'Largest US bank by broad franchise scale' },
      { name: 'Bank of America', ticker: 'BAC', role: 'Money-center bank' },
      { name: 'Wells Fargo', ticker: 'WFC', role: 'Large US bank' },
      { name: 'Citigroup', ticker: 'C', role: 'Global bank' },
      { name: 'Capital One', ticker: 'COF', role: 'Credit cards and consumer banking' },
      { name: 'Goldman Sachs', ticker: 'GS', role: 'Investment banking and markets' },
    ]
  ),
  'fintech-capital-markets': financialPrimer(
    'Fintech and capital-markets infrastructure covers exchanges, trading networks, data platforms, digital banking, and payments-adjacent businesses.',
    ['Exchanges and market data', 'Trading and brokerage infrastructure', 'Digital banking and consumer fintech', 'Payments and merchant services'],
    ['Trading volumes and volatility', 'Take rates and payment volume', 'Regulation of interchange and digital assets', 'Operating leverage from market activity'],
    [
      { name: 'CME Group', ticker: 'CME', role: 'Derivatives exchange and market data' },
      { name: 'Intercontinental Exchange', ticker: 'ICE', role: 'Exchanges, data, and mortgage tech' },
      { name: 'Nasdaq', ticker: 'NDAQ', role: 'Exchange and market technology' },
      { name: 'Block', ticker: 'XYZ', role: 'Merchant and consumer fintech' },
      { name: 'Coinbase', ticker: 'COIN', role: 'Crypto exchange and infrastructure' },
      { name: 'Robinhood', ticker: 'HOOD', role: 'Retail brokerage and fintech platform' },
    ]
  ),
  'semicap-materials': aiClusterPrimer(
    'Semicap materials and equipment suppliers sell the tools, process-control systems, chemicals, and materials required to manufacture semiconductors.',
    ['Lithography, etch, deposition, and inspection tools', 'Materials, chemicals, and gases', 'Process control and metrology', 'Advanced packaging equipment'],
    ['Wafer fab equipment spending', 'Memory versus logic capex', 'China restrictions and demand pull-ins', 'Advanced packaging bottlenecks'],
    [
      { name: 'ASML', ticker: 'ASML', role: 'Lithography equipment' },
      { name: 'Applied Materials', ticker: 'AMAT', role: 'Deposition, etch, and process equipment' },
      { name: 'Lam Research', ticker: 'LRCX', role: 'Etch and deposition equipment' },
      { name: 'KLA', ticker: 'KLAC', role: 'Process control and inspection' },
      { name: 'Tokyo Electron', role: 'Semiconductor production equipment', kind: 'Public' },
      { name: 'Entegris', ticker: 'ENTG', role: 'Materials and contamination-control supplies' },
    ]
  ),
  'edge-power-semis': aiClusterPrimer(
    'Edge and power semiconductors include processor IP, analog, mixed-signal, RF, microcontrollers, and power devices used outside the core AI accelerator.',
    ['Processor IP and edge AI chips', 'Analog and mixed-signal semis', 'Power semiconductors', 'Automotive and industrial microcontrollers'],
    ['Industrial and auto inventory cycles', 'Power-device adoption', 'Edge AI attach rates', 'China local competition'],
    [
      { name: 'Arm', ticker: 'ARM', role: 'Processor IP' },
      { name: 'Texas Instruments', ticker: 'TXN', role: 'Analog and embedded semiconductors' },
      { name: 'Analog Devices', ticker: 'ADI', role: 'Analog and mixed-signal semis' },
      { name: 'NXP Semiconductors', ticker: 'NXPI', role: 'Automotive and industrial semis' },
      { name: 'ON Semiconductor', ticker: 'ON', role: 'Power and sensing semis' },
      { name: 'Infineon', role: 'Power and automotive semis', kind: 'Public' },
    ]
  ),
  'storage-hardware': aiClusterPrimer(
    'Storage hardware includes disk drives, flash, SSDs, and enterprise storage systems. It is driven by cloud capex, AI data retention, enterprise refresh cycles, and memory/storage supply discipline.',
    ['Hard drives and nearline storage', 'Flash and SSDs', 'Enterprise storage systems', 'Controllers and storage software'],
    ['Cloud nearline demand', 'NAND pricing', 'Enterprise hardware refresh cycles', 'AI data retention and retrieval needs'],
    [
      { name: 'Seagate', ticker: 'STX', role: 'Hard-drive storage' },
      { name: 'Western Digital', ticker: 'WDC', role: 'HDD and flash storage' },
      { name: 'SanDisk', ticker: 'SNDK', role: 'Flash storage' },
      { name: 'NetApp', ticker: 'NTAP', role: 'Enterprise storage systems' },
      { name: 'Pure Storage', ticker: 'PSTG', role: 'Enterprise flash storage systems' },
      { name: 'Micron Technology', ticker: 'MU', role: 'NAND and memory' },
    ]
  ),
  'aerospace-and-transport': industrialPrimer(
    'Aerospace and transport includes aircraft supply chains, rail equipment, airlines, and transport infrastructure. Exposure can reflect defense/aerospace backlogs or a cyclical view on travel and freight.',
    ['Aircraft OEMs and suppliers', 'Engines and aftermarket', 'Rail equipment and freight infrastructure', 'Airlines and travel demand'],
    ['Aircraft production rates', 'Aftermarket margins', 'Labor and fuel costs', 'Freight volumes and airline capacity discipline'],
    [
      { name: 'Boeing', ticker: 'BA', role: 'Commercial aerospace and defense OEM' },
      { name: 'Airbus', role: 'Commercial aerospace OEM', kind: 'Public' },
      { name: 'RTX', ticker: 'RTX', role: 'Aerospace systems and engines' },
      { name: 'GE Aerospace', ticker: 'GE', role: 'Aircraft engines and services' },
      { name: 'Union Pacific', ticker: 'UNP', role: 'Freight rail' },
      { name: 'Delta Air Lines', ticker: 'DAL', role: 'Airline exposure' },
    ]
  ),
  'power-and-electrification': industrialPrimer(
    'Power and electrification is the broad industrial layer behind load growth: generation, grid equipment, power management, and electrical systems.',
    ['Power generation equipment', 'Electrical distribution and automation', 'Grid and transmission hardware', 'Backup power and distributed energy'],
    ['Utility and data center capex', 'Backlogs and lead times', 'Grid interconnection bottlenecks', 'Margin durability after supply constraints ease'],
    [
      { name: 'GE Vernova', ticker: 'GEV', role: 'Power generation and grid equipment' },
      { name: 'Eaton', ticker: 'ETN', role: 'Electrical equipment and power management' },
      { name: 'Schneider Electric', role: 'Electrification and automation', kind: 'Public' },
      { name: 'ABB', ticker: 'ABBNY', role: 'Electrification and automation' },
      { name: 'Bloom Energy', ticker: 'BE', role: 'Distributed fuel-cell power' },
      { name: 'Vertiv', ticker: 'VRT', role: 'Data center power and thermal infrastructure' },
    ]
  ),
  'energy-resources': industrialPrimer(
    'Energy resources covers oil, gas, and service exposure. It can be a commodity-price view, a capital discipline view, or an infrastructure-demand view tied to power and industrial load.',
    ['Oil and gas producers', 'Integrated majors', 'Oilfield services', 'Midstream and LNG infrastructure'],
    ['Commodity prices', 'Capex discipline', 'Service-cost inflation', 'LNG and power-demand growth'],
    [
      { name: 'Exxon Mobil', ticker: 'XOM', role: 'Integrated oil and gas major' },
      { name: 'Chevron', ticker: 'CVX', role: 'Integrated oil and gas major' },
      { name: 'EQT', ticker: 'EQT', role: 'Natural gas producer' },
      { name: 'ConocoPhillips', ticker: 'COP', role: 'Large E&P' },
      { name: 'SLB', ticker: 'SLB', role: 'Oilfield technology and services' },
      { name: 'Halliburton', ticker: 'HAL', role: 'Oilfield services' },
    ]
  ),
  'metals-and-materials': industrialPrimer(
    'Metals and materials cover the commodity and processed-input layer for construction, electrification, infrastructure, autos, and industrial production.',
    ['Copper, aluminum, steel, and aggregates', 'Mining and processing', 'Specialty materials', 'Construction materials and cement'],
    ['Commodity prices', 'China demand and supply discipline', 'Infrastructure and electrification capex', 'Energy costs and permitting'],
    [
      { name: 'Freeport-McMoRan', ticker: 'FCX', role: 'Copper producer' },
      { name: 'Nucor', ticker: 'NUE', role: 'Steel producer' },
      { name: 'Steel Dynamics', ticker: 'STLD', role: 'Steel producer' },
      { name: 'Alcoa', ticker: 'AA', role: 'Aluminum producer' },
      { name: 'Vulcan Materials', ticker: 'VMC', role: 'Aggregates and construction materials' },
      { name: 'Cleveland-Cliffs', ticker: 'CLF', role: 'Steel and iron ore' },
    ]
  ),
  'industrial-tech': industrialPrimer(
    'Industrial tech captures automation, displays, recycling systems, sensors, and specialized equipment that can improve productivity or serve niche industrial cycles.',
    ['Automation and controls', 'Sensors and test equipment', 'Industrial recycling and circular-economy systems', 'Specialty displays and equipment'],
    ['Factory automation demand', 'Electronics and display cycles', 'Industrial capex', 'Margin mix between equipment and services'],
    [
      { name: 'Rockwell Automation', ticker: 'ROK', role: 'Factory automation' },
      { name: 'Emerson Electric', ticker: 'EMR', role: 'Industrial automation and controls' },
      { name: 'Honeywell', ticker: 'HON', role: 'Automation and industrial systems' },
      { name: 'Fortive', ticker: 'FTV', role: 'Industrial technology and instrumentation' },
      { name: 'Amphenol', ticker: 'APH', role: 'Connectors and sensors' },
      { name: 'Corning', ticker: 'GLW', role: 'Specialty glass and display materials' },
    ]
  ),
  'broad-market-etfs': marketPrimer(
    'Broad-market ETFs are portfolio-level instruments used to add or reduce US equity beta quickly.',
    ['S&P 500 and total-market ETFs', 'Nasdaq and growth-heavy ETFs', 'Equal-weight or factor variants', 'Index exposure used around single-name rotations'],
    ['Index concentration', 'Rate expectations', 'Earnings breadth', 'Whether ETF exposure offsets or amplifies single-name risk'],
    [
      { name: 'SPDR S&P 500 ETF', ticker: 'SPY', role: 'S&P 500 exposure', kind: 'ETF' },
      { name: 'Vanguard S&P 500 ETF', ticker: 'VOO', role: 'S&P 500 exposure', kind: 'ETF' },
      { name: 'iShares Core S&P 500 ETF', ticker: 'IVV', role: 'S&P 500 exposure', kind: 'ETF' },
      { name: 'Invesco QQQ Trust', ticker: 'QQQ', role: 'Nasdaq-100 exposure', kind: 'ETF' },
      { name: 'Vanguard Total Stock Market ETF', ticker: 'VTI', role: 'US total-market exposure', kind: 'ETF' },
    ]
  ),
  'em-country-etfs': marketPrimer(
    'EM and country ETFs express views on non-US equity markets, currencies, commodity cycles, geopolitics, and relative growth.',
    ['Broad emerging-market ETFs', 'Single-country ETFs', 'China, India, Brazil, Mexico, and other country exposures', 'Currency and commodity sensitivity'],
    ['Dollar strength', 'Local rates and inflation', 'Country-specific politics', 'Commodity cycles and China demand'],
    [
      { name: 'iShares MSCI Emerging Markets ETF', ticker: 'EEM', role: 'Broad emerging-market exposure', kind: 'ETF' },
      { name: 'Vanguard FTSE Emerging Markets ETF', ticker: 'VWO', role: 'Broad emerging-market exposure', kind: 'ETF' },
      { name: 'iShares China Large-Cap ETF', ticker: 'FXI', role: 'China large-cap exposure', kind: 'ETF' },
      { name: 'iShares MSCI India ETF', ticker: 'INDA', role: 'India equity exposure', kind: 'ETF' },
      { name: 'iShares MSCI Brazil ETF', ticker: 'EWZ', role: 'Brazil equity exposure', kind: 'ETF' },
    ]
  ),
};

export function getSegmentPrimer(slug: string): SegmentPrimer | null {
  return segmentPrimers[slug] ?? null;
}
