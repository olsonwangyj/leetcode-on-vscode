# LeetCode on VSCode

Solve LeetCode problems in VS Code with faster testing, cleaner submissions, and a focused workspace layout.

## Features

- Browse, search, and open LeetCode problems directly in VS Code.
- Keep the problem description on the left and your code on the right.
- Run tests with a faster direct workflow instead of jumping through extra prompts.
- Debug Java solutions with real VS Code breakpoints from the editor title bar.
- Parse multiple examples from the problem description and run them in sequence.
- Save failed submission cases and replay them in later local tests.
- Read cleaner grouped submission output with inputs, outputs, and comparisons.
- Keep the workspace tidy by closing the previous problem tab when it is safe to do so.
- Automatically collapse the sidebar after opening a problem so you can focus on coding.

## Quick Start

1. Install the extension.
2. Open the LeetCode view in the Activity Bar.
3. Run `LeetCode: Sign In`.
4. Open a problem from the explorer.
5. Write your solution and test locally.
6. Submit when you are ready.

## Recommended Workflow

- Open a problem and start coding with the description visible beside your solution file.
- Use the direct test command to run the available examples quickly.
- Review grouped results in the submission panel instead of scanning raw output.
- Submit once the local examples and any saved failed cases look correct.

## Testing and Submission

- Testing supports multiple examples extracted from the problem description.
- Failed cases from previous submissions can be replayed in later test runs.
- Submission results are formatted into clearer sections for faster debugging.
- Local `stdout` is preserved when LeetCode returns it, which makes `println`-style debugging easier.

## Debugging in VS Code

- Open a Java solution and click the `Debug in VS Code` bug button in the editor title bar.
- Pick an official example, a failed case, a saved case from `.debug.txt`, or `Custom Input...`.
- Custom input is collected one parameter at a time, so you can type values the same way you would in LeetCode's `Input` box.
- `Open Debug Cases File` creates a sibling `.debug.txt` file where you can keep your own reusable cases.
- On a fresh machine, the first debug run may ask you to install the Java debugger tools or a JDK. Use the guided buttons, finish the one-time setup, then click `Debug in VS Code` again.

## Workspace Behavior

- Problem description opens on the left.
- Code opens on the right.
- The sidebar collapses after opening a problem.
- The Activity Bar remains visible.
- The previous LeetCode code tab is closed automatically when it is safe.

## Commands

- `LeetCode: Sign In`
- `LeetCode: Show Problem`
- `LeetCode: Test in LeetCode`
- `LeetCode: Test in LeetCode (Direct)`
- `LeetCode: Submit to LeetCode`
- `LeetCode: Search Problem`

## Local Packaging

From the extension folder:

```bash
npm install
npx @vscode/vsce package
```

If you already have `vsce` installed globally:

```bash
vsce package
```

You can also use the included helper scripts:

```bash
./scripts/release.sh package
./scripts/release.sh publish
./scripts/release.sh verify
```

More release notes and maintenance steps are documented in [RELEASE.md](./RELEASE.md).
