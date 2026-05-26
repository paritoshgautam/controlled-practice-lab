const k = 8.99e9;

const fmt = (value, digits = 2) => Number(value.toFixed(digits));

const numeric = (id, prompt, answer, unit, tolerance, explanation) => ({
  id,
  type: "numeric",
  prompt,
  answer,
  unit,
  tolerance,
  explanation,
});

const choice = (id, prompt, options, answer, explanation) => ({
  id,
  type: "choice",
  prompt,
  options,
  answer,
  explanation,
});

const workUpload = (id, prompt, rubric, keywords, sample) => ({
  id,
  type: "work_upload",
  prompt,
  rubric,
  keywords,
  sample,
});

const termQuestions = [
  ["current", "I", "ampere", "A", "rate of charge flow"],
  ["emf", "E or V", "volt", "V", "energy supplied per coulomb by a source"],
  ["resistance", "R", "ohm", "ohm", "opposition to charge flow"],
  ["work", "W", "joule", "J", "energy transferred by a force or electric field"],
  ["energy", "E", "joule", "J", "ability to do work"],
  ["power", "P", "watt", "W", "rate of energy transfer"],
];

const safetyPrompts = [
  ["ground fault interrupter", ["imbalance", "hot", "neutral", "shuts", "shock"], "A GFI compares current in the hot and neutral paths and opens the circuit quickly if some current leaks to ground, reducing shock risk."],
  ["fuse", ["melts", "overload", "current", "opens"], "A fuse has a metal strip that melts when current is too large, opening the circuit."],
  ["circuit breaker", ["switch", "overload", "current", "reset"], "A circuit breaker trips open during excessive current and can be reset after the fault is fixed."],
  ["polarized plug", ["wide", "narrow", "hot", "neutral"], "A polarized plug forces hot and neutral to connect the intended way so switches and cases are safer."],
  ["three-pronged plug", ["ground", "fault", "case", "path"], "A three-pronged plug adds a ground path so a fault can trip protection instead of energizing the device case."],
];

const resistanceFactors = [
  "longer wire increases resistance",
  "larger cross-sectional area decreases resistance",
  "higher resistivity material increases resistance",
  "higher temperature usually increases metal resistance",
];

function coulombQuestion(n) {
  const q1u = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20][n - 1];
  const q2u = [4, 5, 6, 8, 9, 10, 12, 14, 16, 18][n - 1];
  const cm = [1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10][n - 1];
  const q1 = q1u * 1e-6;
  const q2 = q2u * 1e-6;
  const r = cm / 100;
  const force = (k * q1 * q2) / (r * r);
  return numeric(
    `t${n}-coulomb`,
    `Two charges, -${q1u} microC and -${q2u} microC, are separated by ${cm} cm. What is the magnitude of the electrostatic force between them? State whether the force is attractive or repulsive in your work.`,
    fmt(force, force > 100 ? 1 : 2),
    "N",
    Math.max(force * 0.03, 0.03),
    `Use F = k|q1q2|/r^2 with microcoulombs converted to coulombs and centimeters converted to meters. Like charges repel, so this force is repulsive.`
  );
}

function chargeQuestion(n) {
  const amps = [2, 1.5, 0.8, 3, 2.4, 1.2, 0.5, 4, 2.1, 1.8][n - 1];
  const hours = [3, 2, 4, 1.5, 2.5, 6, 8, 0.75, 5, 3.5][n - 1];
  const q = amps * hours * 3600;
  return numeric(
    `t${n}-charge`,
    `A charger supplies ${amps} A for ${hours} h. How much charge passes into the device?`,
    fmt(q, 0),
    "C",
    Math.max(q * 0.02, 2),
    "Use Q = It. Convert hours to seconds before multiplying."
  );
}

function ohmQuestion(n) {
  const volts = [12, 9, 18, 24, 6, 15, 30, 10, 48, 36][n - 1];
  const current = [3, 0.5, 2, 4, 0.25, 1.5, 5, 2.5, 6, 0.75][n - 1];
  return numeric(
    `t${n}-ohm`,
    `A ${volts} V battery is connected across one resistor and the current is ${current} A. What is the resistance?`,
    fmt(volts / current, 2),
    "ohm",
    0.05,
    "Use Ohm's law R = V/I."
  );
}

function seriesQuestion(n) {
  const r1 = [10, 8, 12, 6, 15, 20, 5, 9, 18, 4][n - 1];
  const r2 = [5, 4, 6, 3, 10, 10, 15, 3, 6, 8][n - 1];
  const v = [12, 24, 18, 9, 30, 60, 20, 36, 48, 12][n - 1];
  const i = v / (r1 + r2);
  const p1 = i * i * r1;
  const p2 = i * i * r2;
  return choice(
    `t${n}-series`,
    `In a series circuit, ${r1} ohm and ${r2} ohm resistors are connected to ${v} V. Which statement is correct?`,
    [
      `The current is ${fmt(i, 2)} A through both resistors, and the ${p1 > p2 ? r1 : r2} ohm resistor dissipates more power.`,
      `The current splits equally, so each resistor gets ${fmt(i / 2, 2)} A.`,
      `The smaller resistor always has the larger voltage drop in series.`,
      `The total resistance is ${fmt(1 / (1 / r1 + 1 / r2), 2)} ohm.`
    ],
    0,
    "Series resistances add, the same current flows through every series component, and P = I^2R."
  );
}

function parallelQuestion(n) {
  const r1 = [10, 8, 12, 6, 15, 20, 5, 9, 18, 4][n - 1];
  const r2 = [5, 4, 6, 3, 10, 10, 15, 3, 6, 8][n - 1];
  const v = [12, 24, 18, 9, 30, 60, 20, 36, 48, 12][n - 1];
  const p1 = (v * v) / r1;
  const p2 = (v * v) / r2;
  return choice(
    `t${n}-parallel`,
    `In a parallel circuit, ${r1} ohm and ${r2} ohm resistors are connected to ${v} V. Which statement is correct?`,
    [
      `Each resistor has ${v} V across it, and the ${p1 > p2 ? r1 : r2} ohm resistor dissipates more power.`,
      `The same current must flow through both resistors.`,
      `The voltage divides in proportion to resistance.`,
      `The total resistance is ${r1 + r2} ohm.`
    ],
    0,
    "Parallel branches share the same voltage. Branch current is V/R, and power is V^2/R."
  );
}

function costQuestion(n) {
  const houses = [20, 16, 24, 12, 30, 18, 25, 15, 22, 28][n - 1];
  const oldW = [75, 60, 100, 75, 90, 60, 75, 100, 80, 75][n - 1];
  const newW = [30, 15, 40, 20, 30, 12, 25, 30, 20, 18][n - 1];
  const hours = [9, 8, 6, 10, 7, 11, 9, 5, 12, 8][n - 1];
  const cents = [8, 12, 10, 15, 9, 11, 14, 13, 16, 7][n - 1];
  const oldKwh = (houses * oldW * hours * 365) / 1000;
  const newKwh = (houses * newW * hours * 365) / 1000;
  const savings = (oldKwh - newKwh) * (cents / 100);
  return numeric(
    `t${n}-cost`,
    `${houses} houses leave ${oldW} W porch bulbs on for ${hours} h/day. If they switch to ${newW} W bulbs and electricity costs ${cents} cents/kWh, what is the yearly cost savings for the block?`,
    fmt(savings, 2),
    "$",
    Math.max(savings * 0.03, 0.5),
    "Find yearly kWh for each bulb type using P(kW) x time, subtract, then multiply by the electricity rate."
  );
}

function filamentQuestion(n) {
  const energy = [6.0, 4.5, 7.2, 3.6, 5.4, 9.0, 8.1, 2.7, 6.3, 10.8][n - 1] * 1e4;
  const amps = [0.17, 0.12, 0.2, 0.1, 0.15, 0.25, 0.18, 0.09, 0.21, 0.3][n - 1];
  const seconds = 3600;
  const p = energy / seconds;
  const r = p / (amps * amps);
  return numeric(
    `t${n}-filament`,
    `A filament bulb uses ${energy.toExponential(1)} J in one hour while ${amps} A flows through it. What is the filament resistance?`,
    fmt(r, 1),
    "ohm",
    Math.max(r * 0.03, 0.5),
    "Convert one hour to 3600 s, use P = E/t, then R = P/I^2."
  );
}

function makeTest(n) {
  const term = termQuestions[(n - 1) % termQuestions.length];
  const safety = safetyPrompts[(n - 1) % safetyPrompts.length];
  const factor = resistanceFactors[(n - 1) % resistanceFactors.length];
  const lampSeriesGreater = n % 2 === 0 ? "B" : "A";
  const lampParallelGreater = n % 2 === 0 ? "C" : "D";
  return {
    id: n,
    title: `Mock Test ${n}`,
    questions: [
      choice(`t${n}-term`, `Which description correctly defines ${term[0]}?`, [`${term[0]} is ${term[4]}; variable ${term[1]}; unit ${term[2]} (${term[3]}).`, `${term[0]} is the same as voltage and is measured only in amperes.`, `${term[0]} is the stored charge in a circuit and has no SI unit.`, `${term[0]} is the length of a wire and is measured in meters per second.`], 0, `${term[0]} is ${term[4]}. It is commonly represented by ${term[1]} and measured in ${term[2]} (${term[3]}).`),
      coulombQuestion(n),
      chargeQuestion(n),
      ohmQuestion(n),
      workUpload(`t${n}-schematic`, `Show your work for drawing a simple circuit with a battery, one resistor, an ammeter, and a voltmeter. Include polarity and conventional current direction.`, `Full credit: closed loop, battery polarity, conventional current from positive terminal, ammeter in series, voltmeter in parallel across the resistor.`, ["closed", "positive", "series", "parallel", "voltmeter", "ammeter"], "The battery and resistor form a closed loop. Conventional current leaves the positive terminal. The ammeter is placed in series, and the voltmeter is placed in parallel across the resistor."),
      seriesQuestion(n),
      parallelQuestion(n),
      choice(`t${n}-brightness-series`, `Two identical bulbs A and B are in series with a battery. How do their brightnesses compare?`, ["A and B have equal brightness.", "A is brighter because it is first.", "B is brighter because it is closer to the negative terminal.", "Both bulbs are off because series circuits cannot light two bulbs."], 0, "Identical series bulbs carry the same current and have equal resistance, so they dissipate equal power."),
      choice(`t${n}-burnout-series`, `Bulbs A and B are in series. If bulb B burns out and opens the circuit, what happens to A?`, ["A goes out.", "A gets brighter.", "A stays the same.", "A becomes a short circuit."], 0, "An open anywhere in a series loop stops current everywhere."),
      choice(`t${n}-series-unequal`, `Bulbs A and B are in series. If ${lampSeriesGreater} has the greater resistance, which bulb is brighter?`, [`${lampSeriesGreater}, because P = I^2R and series current is the same.`, `${lampSeriesGreater === "A" ? "B" : "A"}, because lower resistance always means more power.`, "They must be equal because series current is the same.", "Neither lights because unequal bulbs cannot be in series."], 0, "In series, the same current flows through both bulbs, so larger R dissipates more power."),
      choice(`t${n}-parallel-burnout`, `Bulbs C and D are in parallel. If bulb D burns out and opens only its branch, what happens to C?`, ["C stays lit at about the same brightness.", "C goes out too.", "C becomes dimmer because current had to pass through D.", "The battery voltage becomes zero."], 0, "Parallel branches have independent paths across the battery."),
      choice(`t${n}-parallel-unequal`, `Bulbs C and D are in parallel. If ${lampParallelGreater} has the greater resistance, which bulb is brighter?`, [`${lampParallelGreater === "C" ? "D" : "C"}, because each branch has the same voltage and P = V^2/R.`, `${lampParallelGreater}, because larger resistance always means more heat.`, "They are equal because voltage is equal.", "Neither, because parallel circuits divide voltage."], 0, "In parallel, each branch has the same voltage, so the smaller resistance branch dissipates more power."),
      choice(`t${n}-voltage-series`, `A 2 ohm, 3 ohm, and 7 ohm resistor are in series across 12 V. What is true about the current and voltage drops?`, ["The current is the same through all three, and the 7 ohm resistor has the largest voltage drop.", "The 2 ohm resistor has the largest voltage drop.", "The current is largest in the 7 ohm resistor.", "Each resistor must have 12 V across it."], 0, "Series current is the same, and V = IR gives larger voltage drop for larger resistance."),
      filamentQuestion(n),
      costQuestion(n),
      choice(`t${n}-ohmic`, `A filament lamp's current-voltage graph curves and gets less steep as voltage rises. What conclusion fits best?`, ["It is non-ohmic because resistance changes with temperature.", "It is ohmic because all lamps obey Ohm's law.", "It has zero resistance.", "Its current is independent of voltage."], 0, "A non-linear I-V graph means the resistance is not constant. A hot filament's resistance increases."),
      numeric(`t${n}-data-resistance`, `An ohmic resistor has data point V = ${7 + n * 0.5} V and I = ${fmt((7 + n * 0.5) / 150, 3)} A. Estimate its resistance.`, 150, "ohm", 4, "For an ohmic resistor, the slope V/I is the resistance."),
      choice(`t${n}-safety`, `Which statement best describes the function of a ${safety[0]}?`, [safety[2], "It increases household voltage so appliances use less current.", "It stores extra charge so lights stay on after power is off.", "It removes all resistance from a household circuit."], 0, safety[2]),
      workUpload(`t${n}-resistance-factor`, `Show your work: what causes electrical resistance, and how does this factor change resistance: ${factor}?`, `Full credit: collisions/interaction of moving charges with atoms plus the named factor's effect on resistance.`, ["collisions", "charges", "atoms", ...factor.split(" ").slice(0, 3)], `Electrical resistance comes from moving charges interacting with atoms in the material. In general, ${factor}.`),
      workUpload(`t${n}-challenge`, `Show your work for this circuit: three equal lamps E, F, and G are arranged with E in series with a parallel pair F and G. Predict what happens if F burns out, and rank brightness before the burnout.`, `Full credit: F opening leaves G still conducting with E in series; total resistance rises, so E and G become dimmer than before; before burnout E is brightest, F and G are equal and dimmer.`, ["parallel", "series", "E", "F", "G", "brightest", "dimmer"], "Before burnout, E is brightest because it carries the total current; F and G are equal and dimmer. If F burns out, G still works but the total circuit resistance increases, reducing current through E and G.")
    ],
  };
}

export const tests = Array.from({ length: 10 }, (_, index) => makeTest(index + 1));
