#!/usr/bin/env python3
"""Ensure survey taxonomy stays aligned between Python and JavaScript sources."""

import json
import re
import unittest
from pathlib import Path

from survey_taxonomy import (
    SURVEY_BINARY_PAIRS,
    SURVEY_VIBE_PAIRS,
    SURVEY_ACTION_OPTIONS,
    SURVEY_EMOTION_OPTIONS,
)

ROOT = Path(__file__).resolve().parent.parent
JS_TAXONOMY = ROOT / 'js' / 'modules' / 'surveyTaxonomy.js'


def _load_js_pairs(const_name):
    source = JS_TAXONOMY.read_text(encoding='utf-8')
    match = re.search(rf'const {const_name} = \[(.*?)\];', source, re.DOTALL)
    if not match:
        raise AssertionError(f'Could not parse {const_name} from {JS_TAXONOMY}')

    pairs = []
    for item in re.finditer(
        r"\{\s*id:\s*'([^']+)',\s*options:\s*\[([^\]]+)\]\s*\}",
        match.group(1),
    ):
        options = [
            option.strip().strip("'\"")
            for option in item.group(2).split(',')
            if option.strip()
        ]
        pairs.append({'id': item.group(1), 'options': options})
    return pairs


def _load_js_action_options():
    source = JS_TAXONOMY.read_text(encoding='utf-8')
    match = re.search(
        r'const SURVEY_OTHER_ACTION_OPTIONS = (\[.*?\]);',
        source,
        re.DOTALL,
    )
    if not match:
        raise AssertionError('Could not parse SURVEY_OTHER_ACTION_OPTIONS')
    payload = match.group(1).replace("'", '"')
    return json.loads(payload)


class SurveyTaxonomyParityTest(unittest.TestCase):
    def test_binary_pairs_match(self):
        js_pairs = _load_js_pairs('SURVEY_BINARY_PAIRS')
        py_pairs = [{'id': pair_id, 'options': list(options)} for pair_id, options in SURVEY_BINARY_PAIRS]
        self.assertEqual(js_pairs, py_pairs)

    def test_vibe_pairs_match(self):
        js_pairs = _load_js_pairs('SURVEY_VIBE_PAIRS')
        py_pairs = [{'id': pair_id, 'options': list(options)} for pair_id, options in SURVEY_VIBE_PAIRS]
        self.assertEqual(js_pairs, py_pairs)

    def test_action_options_match(self):
        self.assertEqual(list(SURVEY_ACTION_OPTIONS), _load_js_action_options())

    def test_emotion_options_present_in_python(self):
        self.assertGreater(len(SURVEY_EMOTION_OPTIONS), 0)
        for facet, options in SURVEY_EMOTION_OPTIONS.items():
            self.assertIsInstance(facet, str)
            self.assertGreater(len(options), 0)


if __name__ == '__main__':
    unittest.main()
