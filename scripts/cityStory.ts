// scripts/cityStory.ts
//
// The words of River City: events, hover text, slider knots and camera
// presets. gen-city.ts adds the buildings and writes the scene JSON.

export const START = 1700;
export const END = 2025;

const range = (from: number, text: string) => ({ from, text });

export const cityStory = {
  id: "city",
  name: "River City",
  minTime: START,
  maxTime: END,
  mapping: {
    kind: "knots",
    interpolate: "linear",
    knots: [
      { u: 0, time: START, label: "1700" },
      { u: 0.12, time: 1760, label: "1760" },
      { u: 0.27, time: 1830, label: "1830" },
      { u: 0.45, time: 1880, label: "1880" },
      { u: 0.6, time: 1930, label: "1930" },
      { u: 0.78, time: 1970, label: "1970" },
      { u: 1, time: END, label: "Today" },
    ],
  },
  timeFormat: "year",
  secondsPerUnit: 31_557_600,
  labels: { start: "Village", end: "Today" },
  baseDurationSeconds: 60,
  warpPresets: [0.25, 0.5, 1, 2, 4],
  events: [
    {
      id: "village",
      time: START,
      title: "A village by the river",
      when: "1700",
      description:
        "A few hundred people farm the fields on both banks. A watermill grinds their grain, and the church is the tallest thing for miles. Almost everyone walks; the river is the main road.",
      keyPoints: ["Most people live and work on farms", "Water power runs the mill", "The river carries goods to the coast"],
      category: "village",
    },
    {
      id: "port",
      time: 1758,
      title: "The port opens",
      when: "1758",
      description:
        "Merchants build a stone quay and brick warehouses on the north bank. Sailing ships load grain and timber and bring back cloth, sugar and tea. The town grows around the trade.",
      keyPoints: ["Stone quays let ships tie up beside the warehouses", "Trade by water was far cheaper than by road", "A wooden bridge joins the two banks in 1765"],
      category: "trade",
    },
    {
      id: "canal",
      time: 1792,
      title: "A canal is dug",
      when: "1792 · the canal mania years",
      description:
        "Investors pay for a canal so barges can bring coal straight to the river. The 1790s were the height of Britain's canal mania, when dozens of canals were approved in a few years.",
      keyPoints: ["A horse could pull about 30 tonnes on a canal barge", "Cheap coal makes new industry possible", "Most canal work was dug by hand"],
      category: "transport",
    },
    {
      id: "gaslight",
      time: 1818,
      title: "Gas lights the streets",
      when: "1818",
      description:
        "Gas made from coal is piped under the streets to lamps along the quay. London's Pall Mall got the first gas street lights in 1807, and cities across Europe followed within twenty years.",
      keyPoints: ["Lamplighters lit each lamp by hand every evening", "Streets became safer after dark", "Gas came from heating coal in a gasworks"],
      category: "light",
    },
    {
      id: "railway",
      time: 1838,
      title: "The railway arrives",
      when: "1838 · eight years after the first intercity line",
      description:
        "A steam railway reaches the south bank, with a grand station and an iron and glass train shed. The world's first intercity passenger line, Liverpool to Manchester, opened in 1830; within twenty years railways linked most large towns.",
      keyPoints: ["A journey that took a day by coach takes an hour or two", "Railway time made towns set their clocks to one standard", "New streets of houses grow up around the station"],
      category: "transport",
    },
    {
      id: "factories",
      time: 1846,
      title: "Factories and smokestacks",
      when: "1846 onward",
      description:
        "Steam-powered mills and works fill the south-east bank, and tall chimneys carry their smoke above the rooftops. Rows of terraced houses go up fast for the workers who pour in from the countryside.",
      keyPoints: ["The town's population multiplies within a lifetime", "Coal smoke blackens buildings and lungs", "Long shifts, six days a week, even for children"],
      category: "industry",
    },
    {
      id: "electric",
      time: 1882,
      title: "Electric light",
      when: "1882",
      description:
        "Electric street lamps replace the gas lamps along the quay, one by one. In 1882 Edison's Pearl Street Station in New York and the Holborn Viaduct station in London began supplying electricity to paying customers.",
      keyPoints: ["Arc lamps and then bulbs replace gas flames", "Power stations send electricity through cables", "Electricity soon drives trams and lifts too"],
      category: "light",
    },
    {
      id: "bridge",
      time: 1887,
      title: "A steel bridge",
      when: "1887 to 1890",
      description:
        "The old wooden bridge comes down and a steel arch bridge goes up, strong enough for heavy carts and, soon, trams. Steel had become cheap after the Bessemer process of the 1850s.",
      keyPoints: ["Steel is stronger than iron, so the frame can be slimmer", "The arch carries the deck on hangers", "Painted red to keep off rust"],
      category: "engineering",
    },
    {
      id: "trams",
      time: 1895,
      title: "Electric trams",
      when: "1895",
      description:
        "Electric trams run across the bridge, fed by a wire overhead. The first electric tram line opened near Berlin in 1881, and by 1900 most big cities had them.",
      keyPoints: ["Trams let workers live further from the factories", "A pole on the roof touches the overhead wire", "Horse trams had run on rails before this"],
      category: "transport",
    },
    {
      id: "skyscrapers",
      time: 1902,
      title: "Skyscrapers",
      when: "1902 to 1931",
      description:
        "Steel frames and safe passenger lifts let buildings climb past ten storeys. The first steel-frame skyscraper, Chicago's Home Insurance Building, went up in 1885. Our stepped art deco tower is finished in 1931, the same year as New York's Empire State Building.",
      keyPoints: ["The steel frame carries the weight, not the walls", "Otis's safety lift made tall buildings practical", "Land in the centre becomes very expensive"],
      category: "architecture",
    },
    {
      id: "cars",
      time: 1957,
      title: "Highways and cars",
      when: "1957",
      description:
        "Cars fill the streets. An elevated highway is built along the north bank, cutting the old town off from its river. The trams are scrapped the same year, as they were in many cities in the 1950s.",
      keyPoints: ["The US Interstate Highway Act passed in 1956", "Cities rebuilt their streets around cars", "Riverside land becomes roads and car parks"],
      category: "transport",
    },
    {
      id: "glass",
      time: 1965,
      title: "Glass towers",
      when: "1965 onward",
      description:
        "Offices in glass and steel boxes replace old blocks. The style came from buildings like New York's Lever House (1952) and Seagram Building (1958): a frame hung with a thin curtain wall of glass.",
      keyPoints: ["Curtain walls carry no weight", "Air conditioning makes sealed glass towers livable", "The business district moves west"],
      category: "architecture",
    },
    {
      id: "decline",
      time: 1976,
      title: "The factories close",
      when: "1976 to 1983",
      description:
        "Work moves to cheaper places and the mills shut one by one. The smoke stops. Like many industrial cities in the 1970s and 1980s, the town loses jobs and people.",
      keyPoints: ["Containers and cheap shipping move factories abroad", "Old works sit empty and polluted", "The steam trains have already gone; electric trains took over in the 1960s"],
      category: "industry",
    },
    {
      id: "park",
      time: 1987,
      title: "A park on the old works",
      when: "1987 · opens in 1992",
      description:
        "The cleaned-up works are laid out as a park with a pond, and one chimney is kept as a monument. Germany's Landscape Park Duisburg-Nord (1994) and Seattle's Gas Works Park (1975) turned old industry into parks the same way.",
      keyPoints: ["Polluted soil is capped or cleaned", "Old industrial landmarks are kept as reminders", "The warehouses become flats and studios"],
      category: "green",
    },
    {
      id: "highway-down",
      time: 2001,
      title: "The highway comes down",
      when: "2001",
      description:
        "The elevated highway is torn down and the waterfront becomes a tree-lined promenade again. San Francisco removed its Embarcadero Freeway in 1991, and Seoul uncovered the Cheonggyecheon stream in 2005.",
      keyPoints: ["Traffic moves to a ring road", "People can walk to the river again", "Land values beside the water rise"],
      category: "green",
    },
    {
      id: "today",
      time: 2012,
      title: "Today",
      when: "2012 to today",
      description:
        "Trams are back as modern light rail, the tallest tower has a garden on its roof, and boats carry visitors past the old mill. The church, the mill and one chimney still stand among glass towers centuries younger than the church.",
      keyPoints: ["Many cities rebuilt tram lines from the 1980s on", "Old buildings get new uses", "More than half of all people now live in cities"],
      category: "today",
    },
  ],
  cameraPresets: [
    { id: "aerial", name: "Aerial", position: [24, 28, 38], target: [1, -1.5, -1] },
    { id: "street", name: "Street level", position: [-1.5, 1.3, 9.5], target: [-1, 3, -6] },
    { id: "river", name: "River view", position: [27, 3.2, 3], target: [0, 1.2, -1] },
  ],
  hover: {
    farm: { name: "Farm", category: "village", description: "A farmhouse and barn. Most families in 1700 grow their own food and sell the rest at the market." },
    river: { name: "The river", category: "nature", description: "The reason the town is here: fresh water, power for the mill, and a road to the sea." },
    "old-town": {
      name: "Old town",
      category: "district",
      descriptions: [
        range(START, "A cluster of cottages around the church and the market place."),
        range(1790, "Cottages give way to taller townhouses as trade brings money in."),
        range(1900, "The east side becomes the business district, with the town's first skyscrapers."),
        range(1957, "Cut off from the river by the elevated highway."),
        range(2001, "Joined to the river again by the new promenade."),
      ],
    },
    docklands: {
      name: "Docklands",
      category: "district",
      descriptions: [
        range(START, "A muddy riverbank where boats pull up."),
        range(1758, "Stone quays and warehouses: the busy heart of the port."),
        range(1960, "Ships have outgrown the river; the docks go quiet."),
        range(1992, "The warehouses are converted into flats and studios."),
      ],
    },
    financial: {
      name: "Financial district",
      category: "district",
      descriptions: [
        range(START, "Fields beyond the edge of town."),
        range(1880, "Blocks of flats for a growing population."),
        range(1962, "Glass office towers rise as banks and offices move in."),
      ],
    },
    "station-quarter": {
      name: "Station quarter",
      category: "district",
      descriptions: [
        range(START, "Farmland on the south bank."),
        range(1836, "Fields cleared for the railway, which is on its way."),
        range(1840, "The new railway station opens, and streets of terraced houses grow up around it."),
      ],
    },
    works: {
      name: "Riverside works",
      category: "district",
      descriptions: [
        range(START, "Fields and a farm."),
        range(1843, "The industrial quarter: mills, works and chimneys."),
        range(1976, "Factories closing one after another."),
        range(1987, "A park with a pond, built on the old works."),
      ],
    },
    church: {
      name: "Old church",
      category: "landmark",
      properties: { Built: "medieval" },
      descriptions: [
        range(START, "The oldest building in town and the tallest for over 150 years."),
        range(1902, "Now dwarfed by the new skyscrapers around it."),
        range(1965, "Still standing among glass towers, centuries older than any of them."),
      ],
    },
    mill: {
      name: "Watermill",
      category: "landmark",
      properties: { Power: "the river" },
      descriptions: [
        range(START, "The river turns the wheel, and the wheel turns millstones that grind grain into flour."),
        range(1890, "Steam and electric mills have taken its work. The wheel has stopped."),
        range(1990, "Restored as a café and small museum."),
      ],
    },
    warehouses: {
      name: "Warehouses",
      category: "trade",
      descriptions: [
        range(START, "Brick stores for grain, timber and imported goods, right on the quay."),
        range(1960, "Standing empty as shipping moves to big container ports."),
        range(1992, "Converted into flats, studios and restaurants."),
      ],
    },
    ships: {
      name: "Boats",
      category: "trade",
      descriptions: [
        range(START, "Wooden sailing ships carrying grain, timber and cloth."),
        range(1862, "A steamship: no more waiting for the wind."),
        range(1998, "A sightseeing boat for visitors."),
      ],
    },
    canal: { name: "Canal", category: "transport", properties: { Dug: "1792 to 1797" }, description: "Dug by hand to bring coal barges to the river. Horses walked the towpath pulling the boats." },
    railway: { name: "Railway line", category: "transport", properties: { Opened: 1838 }, description: "The line that brought the industrial age to town." },
    station: {
      name: "Railway station",
      category: "landmark",
      properties: { Opened: 1840 },
      descriptions: [
        range(START, "A grand stone station and an iron and glass train shed."),
        range(1995, "Restored, with a new glass roof on the old shed."),
      ],
    },
    train: {
      name: "Train",
      category: "transport",
      descriptions: [range(START, "A steam locomotive pulling passenger carriages."), range(1966, "An electric train: quieter, cleaner and faster.")],
    },
    "riverside-works": {
      name: "Riverside works",
      category: "landmark",
      properties: { Opened: 1850, Closed: 1978 },
      description: "The first big factory in town: a steam-powered textile mill employing hundreds of workers.",
    },
    factories: { name: "Factory", category: "industry", description: "Steam engines drive the machines inside; coal smoke pours from the chimney." },
    chimney: {
      name: "The old chimney",
      category: "landmark",
      descriptions: [
        range(START, "The chimney of the riverside works, 42 metres of brick."),
        range(1978, "The works have closed. The chimney is left standing while the site is cleared."),
        range(1987, "Kept as a monument in the new park on the old works."),
      ],
    },
    smoke: { name: "Coal smoke", category: "industry", description: "Soot and sulphur from burning coal. It blackened buildings and caused deadly smogs in industrial cities." },
    terraces: {
      name: "Terraced houses",
      category: "housing",
      descriptions: [
        range(START, "Rows of small brick houses built quickly for factory workers, often two rooms up and two down."),
        range(1963, "Some rows are cleared for modern blocks of flats."),
      ],
    },
    "wooden-bridge": { name: "Wooden bridge", category: "transport", properties: { Built: 1765 }, description: "A timber bridge on wooden piles. Before it, people crossed by ferry." },
    bridge: { name: "Steel arch bridge", category: "landmark", properties: { Opened: 1890, Material: "steel" }, description: "A through-arch bridge: the deck hangs from two red steel arches." },
    tram: { name: "Electric tram", category: "transport", properties: { Years: "1895 to 1957" }, description: "Powered from an overhead wire through the pole on its roof." },
    "light-rail": { name: "Light rail", category: "transport", properties: { Since: 2012 }, description: "Trams are back: modern, low-floor and electric." },
    "gas-lamps": { name: "Gas lamp", category: "light", description: "Coal gas burned in a glass lantern. A lamplighter lit it every evening." },
    "electric-lamps": { name: "Electric streetlight", category: "light", description: "Brighter than gas, and switched on from a power station." },
    highway: { name: "Elevated highway", category: "transport", properties: { Built: 1957, Demolished: 2001 }, description: "A raised road for cars along the river. Fast for drivers, but it walled the town off from the water." },
    "ring-road": { name: "Ring road", category: "transport", properties: { Built: 1962 }, description: "Takes through traffic around the centre instead of through it." },
    cars: { name: "Cars", category: "transport", description: "Mass-produced cars filled the streets after the Second World War." },
    promenade: { name: "Riverside promenade", category: "green", properties: { Opened: 2004 }, description: "Trees and a footpath where the elevated highway used to run." },
    park: { name: "Works Park", category: "green", properties: { Opened: 1992 }, description: "A pond and trees on cleaned-up factory land." },
    exchange: {
      name: "Exchange Building",
      category: "landmark",
      properties: { Built: 1902, Frame: "steel" },
      description: "The town's first skyscraper: a steel frame clad in stone, with lifts to every floor.",
    },
    meridian: {
      name: "Meridian Tower",
      category: "landmark",
      properties: { Built: 1931, Style: "art deco" },
      description: "Stepped back as it rises, like the New York towers of the time, and topped with a spire.",
    },
    "glass-tower": {
      name: "Glass tower",
      category: "landmark",
      properties: { Built: 1968, Style: "International Style" },
      description: "A plain box with a glass curtain wall, the office building of its age.",
    },
    "river-spire": {
      name: "River Spire",
      category: "landmark",
      properties: { Built: 2014 },
      description: "The tallest building in town, with a garden on its roof.",
    },
  },
};
