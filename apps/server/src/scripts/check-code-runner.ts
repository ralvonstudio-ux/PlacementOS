/**
 * Smoke test for the configured code runner (OnlineCompiler.io or Judge0): runs a tiny
 * "sum two numbers" program in every supported language against two stdins, plus a compile
 * error and an infinite loop, and prints one line per check.
 *
 *   npx tsx src/scripts/check-code-runner.ts            # all checks
 *   npx tsx src/scripts/check-code-runner.ts --load 20  # also N simultaneous runs (uses quota)
 */
import 'dotenv/config';
import { activeCodeRunner, runCodeBatch } from '../lib/code-runner';
import type { CodingLanguage } from '../features/tests/test.model';

const PROGRAMS: Record<CodingLanguage, string> = {
  python: 'a, b = map(int, input().split())\nprint(a + b)\n',
  javascript: "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
  c: '#include <stdio.h>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}\n',
  cpp: '#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}\n',
  java: 'import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}\n',
};

async function main() {
  console.log(`runner: ${activeCodeRunner() ?? 'NOT CONFIGURED'}`);
  for (const [language, code] of Object.entries(PROGRAMS) as [CodingLanguage, string][]) {
    const started = Date.now();
    try {
      const runs = await runCodeBatch({ code, language, stdins: ['1 2\n', '40 2\n'] });
      const ok = runs[0]?.stdout.trim() === '3' && runs[1]?.stdout.trim() === '42';
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${language.padEnd(10)} ${Date.now() - started}ms  ${runs.map((r) => `${r.status}:${JSON.stringify(r.stdout.trim())}${r.stderr ? ` err=${JSON.stringify(r.stderr.slice(0, 80))}` : ''}`).join(' | ')}`);
    } catch (err) {
      console.log(`FAIL  ${language.padEnd(10)} threw: ${(err as Error).message}`);
    }
  }

  const compile = await runCodeBatch({ code: 'int main( { return 0; }', language: 'c', stdins: ['', ''] });
  console.log(`${compile.every((r) => r.statusId === 6 && r.compileOutput) ? 'PASS' : 'FAIL'}  compile error -> ${compile[0]?.status}: ${compile[0]?.compileOutput.split('\n')[0]?.slice(0, 90)}`);

  const loop = await runCodeBatch({ code: 'while True:\n    pass\n', language: 'python', stdins: [''], timeoutSeconds: 2 });
  console.log(`${loop[0]?.statusId === 5 ? 'PASS' : 'FAIL'}  infinite loop -> ${loop[0]?.status}`);

  const loadIdx = process.argv.indexOf('--load');
  if (loadIdx !== -1) {
    const n = Number(process.argv[loadIdx + 1] ?? 20);
    const started = Date.now();
    const times: number[] = [];
    let failed = 0;
    await Promise.all(
      Array.from({ length: n }, async () => {
        const t0 = Date.now();
        try {
          const [r] = await runCodeBatch({ code: PROGRAMS.python, language: 'python', stdins: ['1 2\n'] });
          if (r?.stdout.trim() !== '3') failed += 1;
        } catch {
          failed += 1;
        }
        times.push(Date.now() - t0);
      })
    );
    times.sort((a, b) => a - b);
    console.log(`LOAD  ${n} simultaneous runs: ${n - failed} ok, ${failed} failed · median ${times[Math.floor(n / 2)]}ms · slowest ${times[n - 1]}ms · total ${Date.now() - started}ms`);
  }
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
