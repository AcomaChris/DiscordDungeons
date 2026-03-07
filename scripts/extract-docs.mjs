#!/usr/bin/env node

// --- @doc Tag Extraction Script ---
// Scans source files for @doc-* comment blocks and injects extracted
// content into markdown files between <!-- @doc-auto-start/end --> markers.
// AGENT: This script must remain dependency-free (Node built-ins only).

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(import.meta.dirname, '..');
const DOCS_DIR = join(ROOT, 'docs');

// --- Section → file mapping ---
const SECTION_MAP = {
  'doc-player': {
    outputDir: 'docs/guides/player',
    sections: {
      Controls: 'controls.md',
      Abilities: 'abilities.md',
      Multiplayer: 'multiplayer.md',
      Objects: 'objects.md',
    },
  },
  'doc-dev': {
    outputDir: 'docs/guides/developer',
    sections: {
      'Debug Panel': 'debug-panels.md',
      'URL Params': 'url-params.md',
      'Bug Reporter': 'bug-reporter.md',
    },
  },
  'doc-creator-tools': {
    outputDir: 'docs/guides/creator-tools',
    sections: {
      'Map Editor': 'map-editor.md',
      'Tile Editor': 'tile-editor.md',
      Scripts: 'scripts.md',
    },
  },
  'doc-creator-content': {
    outputDir: 'docs/guides/creator-content',
    sections: {
      Abilities: 'abilities.md',
      Components: 'components.md',
      Maps: 'maps.md',
      Objects: 'objects.md',
      Scripting: 'scripting.md',
    },
  },
};

const TAG_PATTERN = /^\/\/\s*@doc-(player|dev|creator-tools|creator-content)\s+(.+)/;
const COMMENT_LINE = /^\/\/\s?(.*)/;

// --- Collect all .js files recursively ---
function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === '.vitepress' || entry === 'dist') continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, files);
    } else if (entry.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

// --- Parse @doc blocks from a single file ---
function parseFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for a new @doc tag
    const tagMatch = trimmed.match(TAG_PATTERN);
    if (tagMatch) {
      // Close previous block
      if (current) blocks.push(current);

      const target = `doc-${tagMatch[1]}`;
      const spec = tagMatch[2].trim();

      // Parse optional priority prefix: "01:Section > Subsection"
      let priority = 50;
      let sectionSpec = spec;
      const priorityMatch = spec.match(/^(\d+):(.+)/);
      if (priorityMatch) {
        priority = parseInt(priorityMatch[1], 10);
        sectionSpec = priorityMatch[2].trim();
      }

      // Split section > subsection
      const parts = sectionSpec.split('>').map((s) => s.trim());
      const section = parts[0];
      const subsection = parts[1] || null;

      current = { target, section, subsection, priority, lines: [], file: filePath };
      continue;
    }

    // Accumulate comment lines into current block
    if (current) {
      const commentMatch = trimmed.match(COMMENT_LINE);
      if (commentMatch !== null) {
        current.lines.push(commentMatch[1]);
      } else {
        // Non-comment line — close block
        blocks.push(current);
        current = null;
      }
    }
  }

  // Close final block
  if (current) blocks.push(current);
  return blocks;
}

// --- Group blocks by target → section → subsection ---
function groupBlocks(allBlocks) {
  const grouped = {};

  for (const block of allBlocks) {
    if (!grouped[block.target]) grouped[block.target] = {};
    if (!grouped[block.target][block.section]) grouped[block.target][block.section] = [];
    grouped[block.target][block.section].push(block);
  }

  // Sort within each section by priority
  for (const target of Object.values(grouped)) {
    for (const section of Object.keys(target)) {
      target[section].sort((a, b) => a.priority - b.priority);
    }
  }

  return grouped;
}

// --- Render grouped blocks for a section into markdown ---
function renderSection(blocks) {
  const parts = [];

  for (const block of blocks) {
    if (block.subsection) {
      parts.push(`### ${block.subsection}`);
      parts.push('');
    }

    // Add source file reference
    const relPath = relative(ROOT, block.file);
    parts.push(`<sub>Source: \`${relPath}\`</sub>`);
    parts.push('');
    parts.push(block.lines.join('\n'));
    parts.push('');
  }

  return parts.join('\n');
}

// --- Inject generated content between markers in a markdown file ---
function injectIntoFile(filePath, content) {
  if (!existsSync(filePath)) {
    // Create file with markers
    const dir = join(filePath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, `<!-- @doc-auto-start -->\n${content}\n<!-- @doc-auto-end -->\n`);
    return;
  }

  const existing = readFileSync(filePath, 'utf-8');
  const startMarker = '<!-- @doc-auto-start -->';
  const endMarker = '<!-- @doc-auto-end -->';

  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    // No markers — append
    writeFileSync(filePath, existing + `\n${startMarker}\n${content}\n${endMarker}\n`);
    return;
  }

  // Replace between markers
  const before = existing.substring(0, startIdx + startMarker.length);
  const after = existing.substring(endIdx);
  writeFileSync(filePath, `${before}\n${content}\n${after}`);
}

// --- Main ---
function main() {
  const scanDirs = [join(ROOT, 'client', 'src'), join(ROOT, 'scripts')];

  const allFiles = [];
  for (const dir of scanDirs) {
    if (existsSync(dir)) {
      collectFiles(dir, allFiles);
    }
  }
  allFiles.sort();

  // Parse all @doc blocks
  const allBlocks = [];
  for (const file of allFiles) {
    allBlocks.push(...parseFile(file));
  }

  if (allBlocks.length === 0) {
    console.log('[extract-docs] No @doc tags found in source files.');
    return;
  }

  console.log(`[extract-docs] Found ${allBlocks.length} @doc block(s) across ${allFiles.length} files.`);

  // Group and render
  const grouped = groupBlocks(allBlocks);
  let filesWritten = 0;

  for (const [target, sections] of Object.entries(grouped)) {
    const config = SECTION_MAP[target];
    if (!config) {
      console.warn(`[extract-docs] Unknown target: ${target}`);
      continue;
    }

    for (const [section, blocks] of Object.entries(sections)) {
      const filename = config.sections[section];
      if (!filename) {
        console.warn(`[extract-docs] Unknown section "${section}" for target "${target}"`);
        continue;
      }

      const outputPath = join(ROOT, config.outputDir, filename);
      const content = renderSection(blocks);
      injectIntoFile(outputPath, content);
      filesWritten++;
    }
  }

  console.log(`[extract-docs] Updated ${filesWritten} markdown file(s).`);
}

main();
