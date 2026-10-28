import type { CreateTestInput } from './test.validation';

/**
 * A ready-made two-section placement assessment — 10 MCQs drawn per candidate from a pool of
 * 15 (aptitude + CS fundamentals) and
 * 5 coding problems, each with visible sample cases and hidden scoring cases. Served to the
 * test builder as a starting template (GET /tests/templates/sample) and seeded into the
 * in-memory demo server, so there is one definition of it.
 *
 * Every coding problem reads stdin and writes stdout, so it's judged identically in every
 * allowed language.
 */

const ALL_LANGUAGES = ['python', 'java', 'c', 'cpp', 'javascript'] as const;

const mcq = (questionText: string, options: string[], correctAnswer: string) => ({
  questionText,
  questionType: 'mcq' as const,
  options,
  correctAnswer,
  marks: 2,
  sectionIndex: 0,
});

const coding = (questionText: string, cases: Array<[input: string, expectedOutput: string, hidden: boolean]>) => ({
  questionText,
  questionType: 'coding' as const,
  marks: 10,
  sectionIndex: 1,
  allowedLanguages: [...ALL_LANGUAGES],
  testCases: cases.map(([input, expectedOutput, hidden]) => ({ input, expectedOutput, hidden })),
});

export const SAMPLE_TEST_TEMPLATE: CreateTestInput = {
  title: 'Placement Readiness Assessment',
  track: 'DSA',
  description:
    'A two-round assessment covering quantitative aptitude, CS fundamentals and hands-on problem solving. ' +
    'Section A is 10 multiple-choice questions; Section B is 5 coding problems you solve in the language of your choice.',
  instructions: [
    'The test runs in fullscreen — leaving fullscreen, switching tabs or windows is logged as a violation.',
    'Copying, pasting and right-clicking are disabled.',
    'Disable all browser extensions before you start.',
    'For coding problems: read input from standard input and print only the answer to standard output.',
    'Use "Run" to check your code against the sample cases, then "Submit code" to judge it against all test cases.',
    'You can move between sections freely until you submit the test.',
  ].join('\n'),
  sections: [
    // A pool of 15 — each candidate gets a random 10.
    { title: 'Section A — Aptitude & CS Fundamentals', description: '10 MCQs · 2 marks each · no negative marking', pickCount: 10 },
    { title: 'Section B — Coding', description: '5 problems · 10 marks each · marks proportional to test cases passed' },
  ],
  durationMinutes: 90,
  violationLimit: 3,
  allowedFullscreenExits: 1,
  requireCamera: true,
  requireScreenShare: true,
  questions: [
    mcq('What is the worst-case time complexity of binary search on a sorted array of n elements?', ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], 'O(log n)'),
    mcq('Which data structure follows the Last-In-First-Out (LIFO) principle?', ['Queue', 'Stack', 'Linked List', 'Heap'], 'Stack'),
    mcq('A train 120 m long runs at 54 km/h. How long does it take to cross a pole?', ['6 seconds', '8 seconds', '10 seconds', '12 seconds'], '8 seconds'),
    mcq('If 20% of a number is 50, what is 60% of that number?', ['100', '125', '150', '175'], '150'),
    mcq('What does the Python expression 2 ** 3 ** 2 evaluate to?', ['64', '512', '36', '81'], '512'),
    mcq('Which SQL clause filters groups after aggregation?', ['WHERE', 'GROUP BY', 'HAVING', 'ORDER BY'], 'HAVING'),
    mcq('What is the worst-case time complexity of Quick Sort?', ['O(n log n)', 'O(n)', 'O(n²)', 'O(log n)'], 'O(n²)'),
    mcq('Find the next number in the series: 2, 6, 12, 20, 30, ?', ['40', '42', '44', '48'], '42'),
    mcq('Which OSI layer is responsible for routing packets between networks?', ['Data Link', 'Transport', 'Network', 'Session'], 'Network'),
    mcq('A and B together finish a job in 12 days. A alone finishes it in 20 days. How many days does B alone take?', ['24', '25', '30', '32'], '30'),
    mcq('Which of these sorting algorithms is stable?', ['Quick Sort', 'Heap Sort', 'Merge Sort', 'Selection Sort'], 'Merge Sort'),
    mcq('A shopkeeper sells an item for ₹540 at a 20% profit. What was the cost price?', ['₹420', '₹432', '₹450', '₹480'], '₹450'),
    mcq('Which Java keyword prevents a method from being overridden?', ['static', 'final', 'private', 'const'], 'final'),
    mcq('The average of 5 numbers is 20. After removing one number the average becomes 18. Which number was removed?', ['24', '26', '28', '30'], '28'),
    mcq('Which data structure does Breadth-First Search use?', ['Stack', 'Queue', 'Priority Queue', 'Hash Map'], 'Queue'),

    coding(
      'Reverse a String\n\nRead a single line of text and print it reversed.\n\nInput: one line (may contain spaces), length ≤ 10^5.\nOutput: the same line, reversed.\n\nExample\nInput:  hello world\nOutput: dlrow olleh',
      [
        ['hello world', 'dlrow olleh', false],
        ['PlacementOS', 'SOtnemecalP', false],
        ['a', 'a', true],
        ['racecar', 'racecar', true],
        ['Data Structures 101', '101 serutcurtS ataD', true],
      ]
    ),
    coding(
      'Prime Check\n\nGiven an integer n, print YES if it is a prime number, otherwise print NO.\n\nInput: one integer n (1 ≤ n ≤ 10^9).\nOutput: YES or NO.\n\nExample\nInput:  7\nOutput: YES',
      [
        ['7', 'YES', false],
        ['12', 'NO', false],
        ['1', 'NO', true],
        ['2', 'YES', true],
        ['999999937', 'YES', true],
        ['1000000000', 'NO', true],
      ]
    ),
    coding(
      'N-th Fibonacci Number\n\nF(0) = 0, F(1) = 1, and F(n) = F(n-1) + F(n-2). Given n, print F(n).\n\nInput: one integer n (0 ≤ n ≤ 50).\nOutput: F(n). (F(50) does not fit in a 32-bit int — use a 64-bit type.)\n\nExample\nInput:  10\nOutput: 55',
      [
        ['10', '55', false],
        ['1', '1', false],
        ['0', '0', true],
        ['20', '6765', true],
        ['50', '12586269025', true],
      ]
    ),
    coding(
      'Maximum Subarray Sum\n\nGiven an array of n integers, print the largest sum of any non-empty contiguous subarray.\n\nInput: the first line has n (1 ≤ n ≤ 10^5); the second line has n space-separated integers (each between -10^4 and 10^4).\nOutput: the maximum subarray sum.\n\nExample\nInput:\n9\n-2 1 -3 4 -1 2 1 -5 4\nOutput: 6',
      [
        ['9\n-2 1 -3 4 -1 2 1 -5 4', '6', false],
        ['1\n5', '5', false],
        ['3\n-3 -1 -2', '-1', true],
        ['5\n1 2 3 4 5', '15', true],
        ['6\n2 -8 3 -2 4 -10', '5', true],
      ]
    ),
    coding(
      'Balanced Brackets\n\nGiven a string made only of the characters ( ) [ ] { }, print YES if every bracket is closed by the matching bracket in the correct order, otherwise print NO.\n\nInput: one line with the bracket string (1 ≤ length ≤ 10^5).\nOutput: YES or NO.\n\nExample\nInput:  {[()]}\nOutput: YES',
      [
        ['{[()]}', 'YES', false],
        ['([)]', 'NO', false],
        ['((', 'NO', true],
        ['()[]{}', 'YES', true],
        [')(', 'NO', true],
        ['{{[[(())]]}}', 'YES', true],
      ]
    ),
  ],
};
