#!/usr/bin/env bun

const proc = Bun.spawn(["bunx", "turbo", "run", "test"]);

await proc.exited;

const output = await new Response(proc.stdout).text();
const errorOutput = await new Response(proc.stderr).text();

process.stdout.write(output);
process.stderr.write(errorOutput);

const fullOutput = output + errorOutput;

console.log("");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("📋 TEST SUMMARY");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const passMatch = fullOutput.match(/(\d+) pass/g);
const failMatch = fullOutput.match(/(\d+) fail/g);
const testsMatch = fullOutput.match(/Ran (\d+) tests?/g);

let totalPass = 0;
let totalFail = 0;
let totalTests = 0;

if (passMatch) {
	passMatch.forEach((m) => {
		totalPass += Number.parseInt(m.split(" ")[0], 10);
	});
}

if (failMatch) {
	failMatch.forEach((m) => {
		totalFail += Number.parseInt(m.split(" ")[0], 10);
	});
}

if (testsMatch) {
	testsMatch.forEach((m) => {
		const num = m.match(/\d+/);
		if (num) totalTests += Number.parseInt(num[0], 10);
	});
}

if (totalTests > 0) {
	console.log(`✅ Passed: ${totalPass} | ❌ Failed: ${totalFail} | 📝 Total Tests: ${totalTests}`);
} else if (totalPass > 0 || totalFail > 0) {
	console.log(`✅ Passed: ${totalPass} | ❌ Failed: ${totalFail}`);
} else {
	console.log("Run tests to see summary");
}

if (totalFail > 0 || proc.exitCode !== 0) {
	process.exit(1);
}
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
