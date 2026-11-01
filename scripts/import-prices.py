"""Import the supplied research workbook; pip install openpyxl if refreshing.

Archived / unconfirmed rows are evidence, never current price candidates.
Existing housing IDs, geography and unrelated fields are preserved.
"""
import datetime
import hashlib
import json
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data-sources/prices/Tyumen_17_ZHK_prices_2026-11-01.xlsx'
KEYS = ['studio', 'one', 'two', 'three', 'four']
LABELS = ['Студия', '1-комнатная', '2-комнатная', '3-комнатная', '4-комнатная']
# Explicit aliases, never fuzzy matching or newly allocated IDs.
IDS = {'Румянский': 0, 'Чистые пруды': 1, 'Мотивы': 2, 'Окинава': 3,
       'Челюскинцев, 5': 4, 'Добро на ДОКе': 5, 'Футуро': 6,
       'Айвазовский': 7, 'Прео': 8, 'Фатера': 9, 'Домашний': 10,
       'Сердце Сибири': 11, 'Остров-сад': 12, 'Сибирский': 13,
       'Символ': 14, 'Сезоны': 15, 'Плэй': 16}


def clean(value):
    return value.date().isoformat() if isinstance(value, datetime.datetime) else value


def main():
    book = openpyxl.load_workbook(SOURCE, data_only=True)
    sheets = {s.title: [[clean(v) for v in row] for row in s.values] for s in book}
    rows = sheets['Источники'][1:]
    missing = sheets['Не найдено'][1:]
    data_path = ROOT / 'public/data/residential.json'
    dataset = json.loads(data_path.read_text())
    homes = {h['id']: h for h in dataset['homes']}
    assert set(homes) == set(IDS.values()), 'Unexpected housing IDs; review mapping'
    populated = 0
    conflicts = []
    for summary in sheets['Цены для карты'][1:]:
        name, developer, *rest = summary
        h = homes[IDS[name]]
        assert h['developer'].casefold() == developer.casefold()
        pricing = {'checkedAt': summary[8], 'website': summary[9],
                   'notes': summary[10] or '', 'categories': {}}
        for index, (key, label) in enumerate(zip(KEYS, LABELS)):
            candidates = [r for r in rows if r[1] == name and r[2] == label and r[11] == 1]
            candidate = min(candidates, key=lambda r: r[3]) if candidates else None
            assert (candidate[3] if candidate else None) == summary[2 + index], (name, key)
            excluded = [r for r in rows if r[1] == name and r[2] == label and r[11] != 1]
            differing = [r for r in excluded if candidate and r[3] != candidate[3]]
            warning = ('В Excel есть отличающиеся архивные или неподтверждённые цены. '
                       'Они не участвуют в расчёте; основания сохранены в аудите источников.') if differing else ''
            if differing:
                conflicts.append({'homeId': h['id'], 'category': key,
                                  'selected': candidate[0], 'excluded': [r[0] for r in differing]})
            if candidate:
                populated += 1
                entry = dict(zip(['offerId', 'home', 'category', 'amount', 'area', 'url',
                                  'checkedAt', 'conditions', 'lot', 'layout', 'evidence', 'eligible'], candidate))
                entry = {k: v for k, v in entry.items() if k not in ['home', 'category', 'eligible', 'evidence']}
                entry['warning'] = warning
            else:
                reasons = [r[5] for r in missing if r[0] == name and r[1] == label]
                assert len(reasons) == 1, (name, label)
                entry = {'amount': None, 'checkedAt': summary[8], 'reason': reasons[0]}
            pricing['categories'][key] = entry
        h['pricing'] = pricing
    assert populated == 67 and len(rows) == 104 and len(missing) == 18
    evidence = {'workbook': SOURCE.name, 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                'policy': 'Minimum among rows marked Для карты = 1; excluded rows retained verbatim.',
                'counts': {'homes': 17, 'categories': 85, 'populated': populated,
                           'missing': 85-populated, 'offers': len(rows), 'eligibleOffers': 67, 'excludedOffers': 37},
                'mapping': IDS, 'conflicts': conflicts, 'sheets': sheets}
    (ROOT / 'public/data/price-evidence.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
    data_path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(evidence['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
