export interface CnsAtlasPanel {
  title: string;
  summary: string;
  points: ReadonlyArray<{ heading: string; text: string }>;
  references: ReadonlyArray<{ label: string; url: string }>;
}

export const CNS_ANATOMY_LABELS = [
  'Posterior spinal cord', 'Cervical enlargement', 'Thoracic spinal cord',
  'Lumbosacral enlargement', 'Spinal subarachnoid space', 'Paired spinal nerve roots',
  'Lumbar cistern', 'Conus medullaris', 'Cauda equina',
] as const;

export const CNS_ATLAS_PANELS: ReadonlyArray<CnsAtlasPanel> = [
  {
    title: 'CNS barriers and interfaces',
    summary: 'Three anatomically different interfaces can admit malignant plasma cells; they are not interchangeable.',
    points: [
      { heading: 'Blood–spinal cord barrier', text: 'Specialized spinal microvascular endothelium, basement membranes, pericytes, and astrocytic endfeet restrict entry into cord parenchyma. It is analogous to, but anatomically distinct from, the cerebral blood–brain barrier.' },
      { heading: 'Blood–CSF barrier', text: 'At the choroid plexus, tight junctions join epithelial cells around fenestrated capillaries. This route enters a lateral ventricle, not brain parenchyma directly.' },
      { heading: 'Leptomeningeal interface', text: 'Pial vascular entry reaches the pia–arachnoid and subarachnoid compartment, permitting cranial and spinal surface disease.' },
    ],
    references: [
      { label: 'Daneman & Prat, Cold Spring Harb Perspect Biol (2015)', url: 'https://doi.org/10.1101/cshperspect.a020412' },
      { label: 'Lun et al., Fluids Barriers CNS (2015)', url: 'https://doi.org/10.1186/2045-8118-12-3' },
    ],
  },
  {
    title: 'Ventricular and craniospinal CSF anatomy',
    summary: 'The blue arrows show normal bulk-flow anatomy separately from the patterned malignant routes.',
    points: [
      { heading: 'Ventricular sequence', text: 'Lateral ventricles → foramina of Monro → third ventricle → cerebral aqueduct → fourth ventricle.' },
      { heading: 'Outflow', text: 'CSF exits through the median aperture of Magendie and paired lateral apertures of Luschka to basal cisterns.' },
      { heading: 'Return pathway', text: 'CSF circulates through cranial and spinal subarachnoid spaces and returns toward dural venous sinuses through arachnoid granulations. Combat shows only a posterior full-length spinal field; the upstream cranial anatomy remains in this atlas.' },
    ],
    references: [
      { label: 'NINDS: Hydrocephalus and CSF circulation', url: 'https://www.ninds.nih.gov/health-information/disorders/hydrocephalus' },
      { label: 'StatPearls: Neuroanatomy, Cerebrospinal Fluid', url: 'https://www.ncbi.nlm.nih.gov/books/NBK470578/' },
    ],
  },
  {
    title: 'CNS myeloma compartments',
    summary: 'The campaign combines clinically described CNS relapse patterns in a deterministic strategy map.',
    points: [
      { heading: 'Leptomeningeal disease', text: 'Cells and deposits occupy cranial or spinal subarachnoid spaces, including the lumbar cistern and cauda-equina region.' },
      { heading: 'Ventricular disease', text: 'Blood–CSF entry seeds ventricular surfaces and may extend toward fourth-ventricle outlets and basal cisterns.' },
      { heading: 'Parenchymal disease', text: 'A hematogenous BBB breach follows a cortical microvascular/perivascular interface to a protected periventricular lesion.' },
    ],
    references: [
      { label: 'Jurczyszyn et al., Am J Hematol: CNS involvement in myeloma (2016)', url: 'https://doi.org/10.1002/ajh.24422' },
      { label: 'Egan et al., Haematologica: CNS myeloma review (2020)', url: 'https://doi.org/10.3324/haematol.2020.264226' },
    ],
  },
  {
    title: 'Disease, ICANS, and abstractions',
    summary: 'Three different concepts are displayed independently and must not be clinically conflated.',
    points: [
      { heading: 'CNS Disease Burden', text: 'Represents malignant CNS relapse. Escapes and active deposits raise it; deposit destruction and wave completion lower it. Ordinary kills do not.' },
      { heading: 'Neurotoxicity / ICANS', text: 'Represents immune-effector-cell neurotoxicity. Dexamethasone affects this toxicity system and can blunt simulated inflammatory pulses, but never damages CNS myeloma or lowers malignant burden.' },
      { heading: 'Interface containment', text: 'The 55-funding delay/block action is a tactical gameplay abstraction, not a drug, procedure, or clinical recommendation.' },
    ],
    references: [
      { label: 'ASTCT consensus grading for CRS and ICANS (2019)', url: 'https://doi.org/10.1016/j.bbmt.2018.12.758' },
      { label: 'Neelapu et al., CAR-T toxicity management (2018)', url: 'https://doi.org/10.1038/nrclinonc.2017.148' },
    ],
  },
] as const;
