from pathlib import Path
import re

ROOT = Path('.')


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label} anchor missing')
    return text.replace(old, new, 1)


def add_import(path):
    text = path.read_text()
    line = 'import { appendRetainedEvent } from "./eventStream.js";\n'
    if line not in text:
        text = line + text
    path.write_text(text)


def replace_generic_writer(path, name='appendEvent'):
    add_import(path)
    text = path.read_text()
    pattern = rf'function {name}\(state, type, subjectId, data = \{{\}}\) \{{\n(?:  .*\n)*?\}}'
    replacement = f'''function {name}(state, type, subjectId, data = {{}}) {{\n  return appendRetainedEvent(state, {{\n    tick: state.tick ?? 0, type, subjectId, data\n  }});\n}}'''
    text, count = re.subn(pattern, replacement, text, count=1)
    if count != 1 and replacement not in text:
        raise SystemExit(f'event writer replacement failed: {path}')
    path.write_text(text)


for rel in [
    'playable_3d/src/core/historicalEconomy.js',
    'playable_3d/src/core/upgrades.js',
    'playable_3d/src/core/upgradeRuntime.js',
    'playable_3d/src/core/researchRuntime.js',
    'playable_3d/src/core/research.js',
    'playable_3d/src/core/legacyCareer.js',
]:
    replace_generic_writer(Path(rel))

staff = Path('playable_3d/src/core/staff.js')
add_import(staff)
s = staff.read_text()
pattern = r'function appendStaffEvent\(state, type, subjectId, data = \{\}\) \{\n(?:  .*\n)*?\}'
replacement = '''function appendStaffEvent(state, type, subjectId, data = {}) {\n  return appendRetainedEvent(state, {\n    tick: Number(state.tick) || 0, type, subjectId, data\n  });\n}'''
s, count = re.subn(pattern, replacement, s, count=1)
if count != 1 and replacement not in s:
    raise SystemExit('staff event writer replacement failed')
staff.write_text(s)

districts = Path('playable_3d/src/core/districts.js')
add_import(districts)
d = districts.read_text()
pattern = r'function appendEvent\(state, districtId, previousTheme, themeId\) \{\n(?:  .*\n)*?\}'
replacement = '''function appendEvent(state, districtId, previousTheme, themeId) {\n  return appendRetainedEvent(state, {\n    tick: state.tick ?? 0,\n    type: "district.theme.changed",\n    subjectId: districtId,\n    data: { previousTheme, themeId }\n  });\n}'''
d, count = re.subn(pattern, replacement, d, count=1)
if count != 1 and replacement not in d:
    raise SystemExit('district event writer replacement failed')
districts.write_text(d)

save = Path('playable_3d/src/core/save.js')
text = save.read_text()
anchor = 'import { normalizeStaffState } from "./staff.js";\n'
additions = 'import { normalizeResearchState } from "./research.js";\nimport { normalizeUpgradeState } from "./upgrades.js";\nimport { normalizeDistrictState } from "./districts.js";\nimport { normalizeHistoricalEconomyState } from "./historicalEconomy.js";\nimport { normalizeLegacyCareerState } from "./legacyCareer.js";\n'
if additions not in text:
    if anchor not in text: raise SystemExit('save import anchor missing')
    text = text.replace(anchor, anchor + additions, 1)
calls_anchor = '  normalizeStaffState(state);\n'
calls = '  normalizeResearchState(state);\n  normalizeUpgradeState(state);\n  normalizeDistrictState(state);\n  normalizeHistoricalEconomyState(state);\n  normalizeLegacyCareerState(state);\n'
if calls not in text:
    if calls_anchor not in text: raise SystemExit('save normalize anchor missing')
    text = text.replace(calls_anchor, calls_anchor + calls, 1)
if 'officeVault:' not in text:
    text = replace_once(text,
        '      cash: payload.state?.economy?.cash ?? 0\n',
        '      cash: payload.state?.economy?.cash ?? 0,\n      officeVault: payload.state?.payments?.officeVault ?? 0,\n      legacyFund: payload.state?.legacy?.fund ?? 0\n',
        'save slot metadata')
save.write_text(text)

headless = Path('runtime/headless-simulator.js')
h = headless.read_text()
h = replace_once(h,
    'import { deserializeGame, serializeGame } from "../playable_3d/src/core/save.js";',
    'import { deserializeGame, migrateState, serializeGame } from "../playable_3d/src/core/save.js";',
    'headless migrate import')
h = replace_once(h,
    '    return new HeadlessSimulator(createNewGame(options));',
    '    return new HeadlessSimulator(migrateState(createNewGame(options)));',
    'headless create normalization')
headless.write_text(h)

coaster = Path('playable_3d/tests/coaster-studio.test.js')
ctext = coaster.read_text()
ctext = replace_once(ctext,
    '  assert.match(main, /!coasterStudio\\.dialog\\.open/);\n',
    '  assert.match(main, /function toolDialogOpen\\(\\)[\\s\\S]*coasterStudio\\.dialog\\.open/);\n  assert.match(main, /speed > 0 && !toolDialogOpen\\(\\)/);\n',
    'Coaster Studio dialog gate')
ctext = replace_once(ctext,
    '  const renderer = read("../src/render/contentStudioWorldRenderer.js");\n',
    '  const renderer = read("../src/render/specialContentWorldRenderer.js");\n',
    'Coaster Studio renderer implementation')
coaster.write_text(ctext)

gilded = Path('playable_3d/tests/gilded-style.test.js')
gtext = gilded.read_text()
final_decl = '  const finalSeam = read("../src/render/finalStyleWorldRenderer.js");\n'
legacy_decl = final_decl + '  const legacySeam = read("../src/render/legacyStyleUpgradeWorldRenderer.js");\n'
if legacy_decl not in gtext:
    gtext = replace_once(gtext, final_decl, legacy_decl, 'Gilded legacy renderer declaration')
gtext = replace_once(gtext,
    '  assert.match(finalSeam, /gildedStyleWorldRenderer/);\n',
    '  assert.match(finalSeam, /legacyStyleUpgradeWorldRenderer/);\n  assert.match(legacySeam, /gildedStyleWorldRenderer/);\n',
    'Gilded compatibility seam')
gilded.write_text(gtext)

historical = Path('playable_3d/tests/historical-economy.test.js')
htext = historical.read_text()
main_decl = '  const main = read("../src/main.js");\n'
legacy_runtime_decl = main_decl + '  const legacyRuntime = read("../src/core/legacyCareerRuntime.js");\n'
if legacy_runtime_decl not in htext:
    htext = replace_once(htext, main_decl, legacy_runtime_decl, 'Historical Legacy runtime declaration')
htext = htext.replace('test("historical economy remains the final additive runtime layer", () => {',
                      'test("historical economy remains active beneath the final Legacy runtime layer", () => {', 1)
htext = replace_once(htext,
    '  assert.match(main, /advanceOneMinuteWithHistoricalEconomy/);\n  assert.match(main, /simulateMinutesWithHistoricalEconomy/);\n',
    '  assert.match(main, /advanceOneMinuteWithLegacyCareer/);\n  assert.match(main, /simulateMinutesWithLegacyCareer/);\n  assert.match(legacyRuntime, /advanceOneMinuteWithHistoricalEconomy/);\n  assert.match(legacyRuntime, /simulateMinutesWithHistoricalEconomy/);\n',
    'Historical runtime chain')
historical.write_text(htext)

legacy = Path('playable_3d/tests/legacy-career.test.js')
ltext = legacy.read_text()
ltext = replace_once(ltext,
    'function state(seed = "legacy-career") {\n  return normalizeLegacyCareerState(normalizeHistoricalEconomyState(createNewGame({ seed, mode: "sandbox" })));\n}\n',
    'function state(seed = "legacy-career") {\n  const park = normalizeLegacyCareerState(normalizeHistoricalEconomyState(createNewGame({ seed, mode: "sandbox" })));\n  for (const objective of park.campaign.objectives ?? []) objective.complete = false;\n  return park;\n}\n',
    'Legacy isolated fixture')
legacy.write_text(ltext)

research = Path('playable_3d/tests/research-growth.test.js')
rtext = research.read_text()
runtime_decl = '  const runtime = read("../src/core/researchRuntime.js");\n'
chain_decl = runtime_decl + '  const upgradeRuntime = read("../src/core/upgradeRuntime.js");\n  const historicalRuntime = read("../src/core/historicalEconomyRuntime.js");\n  const legacyRuntime = read("../src/core/legacyCareerRuntime.js");\n'
if chain_decl not in rtext:
    rtext = replace_once(rtext, runtime_decl, chain_decl, 'Research runtime chain declarations')
rtext = replace_once(rtext,
    '  assert.match(main, /advanceOneMinuteWithResearch/);\n',
    '  assert.match(main, /advanceOneMinuteWithLegacyCareer/);\n  assert.match(legacyRuntime, /advanceOneMinuteWithHistoricalEconomy/);\n  assert.match(historicalRuntime, /advanceOneMinuteWithUpgrades/);\n  assert.match(upgradeRuntime, /advanceOneMinuteWithResearch/);\n',
    'Research runtime chain')
research.write_text(rtext)

seasonal = Path('playable_3d/tests/seasonal-tech-styles.test.js')
stext = seasonal.read_text()
final_decl = '  const finalSeam = read("../src/render/finalStyleWorldRenderer.js");\n'
legacy_decl = final_decl + '  const legacySeam = read("../src/render/legacyStyleUpgradeWorldRenderer.js");\n'
if legacy_decl not in stext:
    stext = replace_once(stext, final_decl, legacy_decl, 'Seasonal Legacy seam declaration')
stext = replace_once(stext,
    '  assert.match(finalSeam, /gildedStyleWorldRenderer/);\n',
    '  assert.match(finalSeam, /legacyStyleUpgradeWorldRenderer/);\n  assert.match(legacySeam, /gildedStyleWorldRenderer/);\n',
    'Seasonal compatibility seam')
seasonal.write_text(stext)

simulation = Path('playable_3d/tests/simulation.test.js')
sim = simulation.read_text()
sim = replace_once(sim,
    'import { deserializeGame, serializeGame } from "../src/core/save.js";\n',
    'import { deserializeGame, migrateState, serializeGame } from "../src/core/save.js";\n',
    'simulation migrate import')
sim = replace_once(sim,
    '  assert.deepEqual(restored, JSON.parse(serialized).state);\n',
    '  assert.deepEqual(restored, migrateState(structuredClone(JSON.parse(serialized).state)));\n',
    'simulation current-schema save expectation')
simulation.write_text(sim)
