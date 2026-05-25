const fmt = (value, digits = 2) => Number(value.toFixed(digits));

const choice = (id, prompt, options, answer, explanation, topic, difficulty = "easy", estimatedMinutes = 2) => ({
  id,
  type: "choice",
  prompt,
  options,
  answer,
  explanation,
  topic,
  difficulty,
  estimatedMinutes,
});

const mcWork = (id, prompt, options, answer, explanation, topic, keywords, sample, difficulty = "medium", estimatedMinutes = 3) => ({
  id,
  type: "mc_work",
  prompt,
  options,
  answer,
  explanation,
  topic,
  keywords,
  sample,
  difficulty,
  estimatedMinutes,
});

const numeric = (id, prompt, answer, unit, tolerance, explanation, topic, difficulty = "medium", estimatedMinutes = 3) => ({
  id,
  type: "numeric",
  prompt,
  answer,
  unit,
  tolerance,
  explanation,
  topic,
  difficulty,
  estimatedMinutes,
});

const open = (id, prompt, rubric, keywords, sample, topic, difficulty = "hard", estimatedMinutes = 4) => ({
  id,
  type: "open",
  prompt,
  rubric,
  keywords,
  sample,
  topic,
  difficulty,
  estimatedMinutes,
});

const shuffleOptions = (correct, wrongs) => {
  const options = [correct, ...wrongs];
  return { options, answer: 0 };
};

function makeMathTest(n) {
  const a = n + 1;
  const b = n + 2;
  const c = n + 3;
  const d = n + 4;
  const q = [];
  const add = (item) => q.push(item);

  add(choice(`m${n}-u1-translate`, `Point A(${a}, ${-b}) is translated by vector <${c}, ${d}>. What are the coordinates of A'?`, shuffleOptions(`(${a + c}, ${-b + d})`, [`(${a - c}, ${-b + d})`, `(${a + c}, ${-b - d})`, `(${c}, ${d})`]).options, 0, "Add the vector components to the original x- and y-coordinates.", "Unit 1: Transformations", "easy", 1));
  add(choice(`m${n}-u1-reflect`, `Reflect (${a}, ${b}) over the line y = -x.`, shuffleOptions(`(${-b}, ${-a})`, [`(${b}, ${a})`, `(${-a}, ${b})`, `(${a}, ${-b})`]).options, 0, "Reflection over y = -x maps (x, y) to (-y, -x).", "Unit 1: Transformations", "easy", 1));
  add(numeric(`m${n}-u1-dilation`, `A segment has length ${4 + n}. It is dilated by scale factor ${fmt((n % 4 + 2) / 2, 1)}. What is the new length?`, fmt((4 + n) * ((n % 4 + 2) / 2), 2), "units", 0.05, "Multiply the original length by the scale factor. A scale factor above 1 is an enlargement; below 1 is a reduction.", "Unit 1: Transformations", "easy", 2));
  add(mcWork(`m${n}-u1-function`, `Which equation represents y = x^2 shifted right ${a} units and up ${b} units?`, [`y = (x - ${a})^2 + ${b}`, `y = (x + ${a})^2 + ${b}`, `y = (x - ${a})^2 - ${b}`, `y = x^2 - ${a} + ${b}`], 0, "A right shift is inside as x - h, and an upward shift adds k outside.", "Unit 1: Transformations", ["right", "x", "minus", "up", "outside"], `Use vertex form y = (x - h)^2 + k, so h = ${a} and k = ${b}.`, "medium", 3));

  add(choice(`m${n}-u2-simplify`, `Simplify (x^2 + ${a + b}x + ${a * b})/(x + ${a}).`, [`x + ${b}, x != ${-a}`, `x + ${a}`, `x - ${b}`, `(x + ${a})(x + ${b})`], 0, `Factor the numerator as (x + ${a})(x + ${b}) and cancel x + ${a}, keeping the restriction.`, "Unit 2: Rational Expressions", "easy", 2));
  add(choice(`m${n}-u2-multiply`, `Simplify [(x^2 - ${a * a})/(x + ${a})] * [(x + ${b})/(x - ${a})].`, [`x + ${b}`, `x - ${b}`, `(x + ${b})/(x + ${a})`, `x^2 + ${b}`], 0, `x^2 - ${a * a} is a difference of squares: (x - ${a})(x + ${a}). Cancel common factors.`, "Unit 2: Rational Expressions", "medium", 3));
  add(numeric(`m${n}-u2-rational-eq`, `Solve ${a}/x = ${b}/${xFor(a, b)}. Enter x.`, fmt((a * xFor(a, b)) / b, 2), "", 0.05, "Cross multiply, then divide to isolate x. Check that x is not 0.", "Unit 2: Rational Equations", "medium", 3));
  add(open(`m${n}-u2-restrictions`, `Explain why restrictions must be checked when solving rational equations. Use x/(x - ${a}) = ${b} as your example.`, "Full credit: denominators cannot be zero, excluded values can appear during algebra, and final answers must be checked for extraneous solutions.", ["denominator", "zero", "undefined", "restriction", "extraneous"], `A rational expression is undefined when its denominator is zero. Here x cannot equal ${a}. Solving steps can create candidate answers, but any candidate that makes a denominator zero is extraneous.`, "Unit 2: Rational Equations", "hard", 4));

  add(numeric(`m${n}-u3-direct`, `y varies directly with x. If y = ${3 * a} when x = ${a}, what is y when x = ${2 * b}?`, fmt((3 * a / a) * (2 * b), 2), "", 0.05, "For direct variation y = kx. Find k from the first pair, then substitute the new x.", "Unit 3: Variation", "easy", 2));
  add(numeric(`m${n}-u3-inverse`, `y varies inversely with x. If y = ${2 * b} when x = ${a}, what is y when x = ${2 * a}?`, fmt(((2 * b) * a) / (2 * a), 2), "", 0.05, "For inverse variation xy = k. Keep the product constant.", "Unit 3: Variation", "medium", 2));
  add(choice(`m${n}-u3-domain`, `Which x-values make (x + ${a})/[(x - ${b})(x + ${c})] undefined?`, [`${b} and ${-c}`, `${-a} only`, `${-b} and ${c}`, `No restrictions`], 0, "A rational expression is undefined where any denominator factor is zero.", "Unit 3: Restrictions", "easy", 2));

  const arithFirst = 5 + n;
  const diff = n % 2 === 0 ? 4 : 3;
  add(choice(`m${n}-u4-seq-type`, `The sequence ${arithFirst}, ${arithFirst + diff}, ${arithFirst + 2 * diff}, ${arithFirst + 3 * diff}, ... is`, ["arithmetic", "geometric", "neither", "both arithmetic and geometric"], 0, "The sequence has a constant difference.", "Unit 4: Sequences", "easy", 1));
  add(numeric(`m${n}-u4-arith-nth`, `For arithmetic sequence a1 = ${arithFirst}, d = ${diff}, find a${10 + n}.`, arithFirst + ((10 + n) - 1) * diff, "", 0.05, "Use an = a1 + (n - 1)d.", "Unit 4: Arithmetic Sequences", "medium", 3));
  const geoFirst = n + 2;
  const ratio = n % 3 + 2;
  add(numeric(`m${n}-u4-geo-nth`, `For geometric sequence a1 = ${geoFirst}, r = ${ratio}, find a5.`, geoFirst * ratio ** 4, "", 0.05, "Use an = a1(r)^(n - 1).", "Unit 4: Geometric Sequences", "medium", 3));
  add(mcWork(`m${n}-u4-recursive`, `A sequence starts at ${a} and each term is multiplied by ${ratio}. Which recursive rule matches it?`, [`a1 = ${a}; an = ${ratio}a(n-1)`, `a1 = ${a}; an = a(n-1) + ${ratio}`, `a1 = ${ratio}; an = ${a}a(n-1)`, `an = ${a}n + ${ratio}`], 0, "A geometric recursive rule gives the first term and multiplies the previous term by the common ratio.", "Unit 4: Recursive Sequences", ["first", "previous", "multiply", "ratio"], `The sequence is geometric, so state a1 = ${a} and multiply the previous term by ${ratio}.`, "medium", 3));

  add(choice(`m${n}-u5-inverse`, `Find the inverse of f(x) = ${a}x - ${b}.`, [`f^-1(x) = (x + ${b})/${a}`, `f^-1(x) = ${a}x + ${b}`, `f^-1(x) = (x - ${b})/${a}`, `f^-1(x) = ${a}/(x + ${b})`], 0, "Swap x and y, then solve for y.", "Unit 5: Inverses", "medium", 3));
  add(numeric(`m${n}-u5-exp`, `Evaluate ${a} * ${b}^3.`, a * b ** 3, "", 0.05, "Evaluate the power first, then multiply by the coefficient.", "Unit 5: Exponentials", "easy", 1));
  add(numeric(`m${n}-u5-interest`, `$${1000 + 100 * n} is invested at ${3 + n}% annual interest compounded yearly for 2 years. What is the balance?`, fmt((1000 + 100 * n) * (1 + (3 + n) / 100) ** 2, 2), "$", 0.1, "Use A = P(1 + r)^t with r written as a decimal.", "Unit 5: Compound Interest", "medium", 3));
  add(choice(`m${n}-u5-log`, `Rewrite log_${b}(${b ** 3}) = 3 in exponential form.`, [`${b}^3 = ${b ** 3}`, `3^${b} = ${b ** 3}`, `${b ** 3}^3 = ${b}`, `log_3(${b}) = ${b ** 3}`], 0, "log base b of a equals c means b^c = a.", "Unit 5: Logarithms", "easy", 2));
  add(mcWork(`m${n}-u5-expand`, `Expand log(x^${a}y/${b}).`, [`${a}log(x) + log(y) - log(${b})`, `log(x) + ${a}log(y) - log(${b})`, `${a}log(x) - log(y) + log(${b})`, `log(${a}xy - ${b})`], 0, "Use power, product, and quotient properties of logarithms.", "Unit 5: Log Properties", ["power", "product", "quotient", "subtract"], `Power brings ${a} down, multiplication becomes addition, and division by ${b} becomes subtraction.`, "hard", 4));
  add(numeric(`m${n}-u5-log-eq`, `Solve log_${b}(x) = 2. Enter x.`, b ** 2, "", 0.05, `Convert to exponential form: x = ${b}^2.`, "Unit 5: Log Equations", "medium", 2));

  add(choice(`m${n}-u6-arc`, `A circle has radius ${a + 5}. What expression gives the arc length for a 60 degree central angle?`, [`(60/360) * 2π(${a + 5})`, `(60/360) * π(${a + 5})^2`, `60 * 2π(${a + 5})`, `(${a + 5})/60`], 0, "Arc length is the fraction of the circumference determined by the central angle.", "Unit 6: Circles", "easy", 2));
  add(numeric(`m${n}-u6-sector`, `Find the sector area of a circle with radius ${a + 3} and central angle 90 degrees. Use π = 3.14.`, fmt((90 / 360) * 3.14 * (a + 3) ** 2, 2), "square units", 0.1, "Sector area is theta/360 times the area of the circle.", "Unit 6: Circles", "medium", 3));
  add(numeric(`m${n}-u6-inscribed`, `An inscribed angle intercepts an arc of ${80 + 4 * n} degrees. What is the angle measure?`, fmt((80 + 4 * n) / 2, 2), "degrees", 0.05, "An inscribed angle is half its intercepted arc.", "Unit 6: Circle Angles", "easy", 2));
  add(numeric(`m${n}-u6-lawcos`, `Two sides of a triangle are ${a + 4} and ${b + 5}, with included angle 60 degrees. Find the opposite side using cos(60)=0.5.`, fmt(Math.sqrt((a + 4) ** 2 + (b + 5) ** 2 - 2 * (a + 4) * (b + 5) * 0.5), 2), "units", 0.1, "Use the Law of Cosines: c^2 = a^2 + b^2 - 2ab cos(C).", "Unit 6: Trigonometry", "hard", 4));

  add(numeric(`m${n}-u7-exp-prob`, `A simulation has ${20 + n} successes in ${80 + 2 * n} trials. What is the experimental probability?`, fmt((20 + n) / (80 + 2 * n), 3), "", 0.005, "Experimental probability is successes divided by total trials.", "Unit 7: Probability", "easy", 2));
  add(choice(`m${n}-u7-or`, `If P(A) = 0.4, P(B) = 0.3, and P(A and B) = 0.1, what is P(A or B)?`, ["0.6", "0.7", "0.12", "0.8"], 0, "Use P(A or B) = P(A) + P(B) - P(A and B).", "Unit 7: Probability Rules", "medium", 2));
  add(choice(`m${n}-u7-conditional`, `In a table, 18 students play a sport, 12 of those students play an instrument, and 30 students total play an instrument. What is P(sport | instrument)?`, ["12/30", "12/18", "18/30", "30/12"], 0, "Conditional probability restricts the denominator to the given group.", "Unit 7: Conditional Probability", "medium", 3));
  add(mcWork(`m${n}-u7-sets`, `Let U = {1,2,3,4,5,6,7,8}, A = {2,4,6,8}, and B = {1,2,3,4}. What is A union B?`, ["{1,2,3,4,6,8}", "{2,4}", "{5,7}", "{1,3,5,7}"], 0, "The union contains everything in A or B, without repeats.", "Unit 7: Sets", ["or", "combine", "union", "repeats"], "Union means include all values that are in A, in B, or in both.", "easy", 2));

  add(numeric(`m${n}-u8-mean`, `A frequency table has values 2, 4, 6 with frequencies ${a}, ${b}, ${c}. What is the mean?`, fmt((2 * a + 4 * b + 6 * c) / (a + b + c), 2), "", 0.05, "Use weighted mean: sum(value x frequency) divided by total frequency.", "Unit 8: Statistics", "medium", 3));
  add(choice(`m${n}-u8-box`, `A box plot has Q1 = ${a}, median = ${a + 5}, Q3 = ${a + 12}. What is the interquartile range?`, [`${12}`, `${5}`, `${a + 12}`, `${a + 17}`], 0, "IQR = Q3 - Q1.", "Unit 8: Box Plots", "easy", 1));
  add(numeric(`m${n}-u8-range`, `Find the range of this dataset: ${a}, ${a + 4}, ${a + 9}, ${a + 13}, ${a + 15}.`, 15, "", 0.05, "Range is maximum minus minimum.", "Unit 8: Dispersion", "easy", 1));
  add(choice(`m${n}-u8-normal`, `In a normal distribution, about what percent of data is within 2 standard deviations of the mean?`, ["95%", "68%", "99.7%", "50%"], 0, "The empirical rule says about 68%, 95%, and 99.7% fall within 1, 2, and 3 standard deviations.", "Unit 8: Normal Distribution", "easy", 1));
  add(open(`m${n}-u8-interpret`, `A histogram is skewed right. Explain whether the mean or median is usually larger and why.`, "Full credit: recognizes right skew, notes high-end tail pulls the mean upward, compares mean and median.", ["right", "tail", "mean", "median", "larger"], "In a right-skewed distribution, the long high-value tail pulls the mean upward, so the mean is usually greater than the median.", "Unit 8: Data Displays", "hard", 4));

  add(open(`m${n}-mixed-adaptive`, `Choose one hard question from this test and describe the strategy you used. Include formulas, restrictions, or probability rules where relevant.`, "Full credit: identifies a problem type, states a correct strategy/formula, and explains why that strategy fits.", ["formula", "because", "solve", "check", "strategy"], "A strong response names the topic, writes the relevant rule, substitutes carefully, and checks restrictions or reasonableness.", "Mixed Units 1-8", "hard", 5));

  return {
    id: n,
    title: `Math Mock Test ${n}`,
    subject: "Math",
    questionCount: 35,
    timeLimitMinutes: 90,
    description: "Math 3 Units 1-8 adaptive-style practice covering transformations, rationals, variation, sequences, logs, circles/trig, probability, and statistics.",
    questions: q,
  };
}

function xFor(a, b) {
  return b * (a + 2);
}

export const mathTests = Array.from({ length: 10 }, (_, index) => makeMathTest(index + 1));
