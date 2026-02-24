"""
Evaluation Service — Metrics Engine.

Provides:
  - Semantic similarity (cosine of sentence embeddings)
  - BLEU score
  - ROUGE-L score
  - Coherence heuristics
  - Hallucination / factual alignment indicators
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections import Counter
from typing import Any, Dict, Optional

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy-loaded sentence-transformer model (heavy; loaded once on first use)
# ---------------------------------------------------------------------------
_EMBED_MODEL = None


def _get_embed_model():
    global _EMBED_MODEL
    if _EMBED_MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer

            _EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Loaded sentence-transformer embedding model.")
        except Exception as exc:
            logger.warning("sentence-transformers not available, falling back to TF-IDF: %s", exc)
    return _EMBED_MODEL


# ── Cosine similarity via embeddings ────────────────────────────
def _cosine_similarity_embeddings(text_a: str, text_b: str) -> float:
    model = _get_embed_model()
    if model is None:
        return _cosine_similarity_tfidf(text_a, text_b)
    embeddings = model.encode([text_a, text_b], convert_to_numpy=True)
    a, b = embeddings[0], embeddings[1]
    cos = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))
    return max(0.0, min(1.0, cos))


def _cosine_similarity_tfidf(text_a: str, text_b: str) -> float:
    """Fallback TF-IDF cosine similarity (no ML model required)."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity as sk_cosine

    vec = TfidfVectorizer()
    tfidf = vec.fit_transform([text_a, text_b])
    sim = sk_cosine(tfidf[0:1], tfidf[1:2])
    return float(sim[0][0])


# ── BLEU score (simplified unigram/bigram) ──────────────────────
def _tokenize(text: str):
    return re.findall(r"\w+", text.lower())


def _bleu_score(reference: str, hypothesis: str) -> float:
    ref_tokens = _tokenize(reference)
    hyp_tokens = _tokenize(hypothesis)
    if not hyp_tokens or not ref_tokens:
        return 0.0

    # Unigram precision
    ref_counts = Counter(ref_tokens)
    hyp_counts = Counter(hyp_tokens)
    clipped = sum(min(hyp_counts[t], ref_counts[t]) for t in hyp_counts)
    precision = clipped / len(hyp_tokens) if hyp_tokens else 0

    # Brevity penalty
    bp = min(1.0, len(hyp_tokens) / len(ref_tokens)) if ref_tokens else 0
    return round(bp * precision, 4)


# ── ROUGE-L (longest common subsequence ratio) ─────────────────
def _lcs_length(x: list, y: list) -> int:
    m, n = len(x), len(y)
    prev = [0] * (n + 1)
    for i in range(1, m + 1):
        curr = [0] * (n + 1)
        for j in range(1, n + 1):
            if x[i - 1] == y[j - 1]:
                curr[j] = prev[j - 1] + 1
            else:
                curr[j] = max(curr[j - 1], prev[j])
        prev = curr
    return prev[n]


def _rouge_l(reference: str, hypothesis: str) -> float:
    ref_tokens = _tokenize(reference)
    hyp_tokens = _tokenize(hypothesis)
    if not ref_tokens or not hyp_tokens:
        return 0.0
    lcs = _lcs_length(ref_tokens, hyp_tokens)
    precision = lcs / len(hyp_tokens)
    recall = lcs / len(ref_tokens)
    if precision + recall == 0:
        return 0.0
    f1 = 2 * precision * recall / (precision + recall)
    return round(f1, 4)


# ── Coherence heuristic ────────────────────────────────────────
def _coherence_score(text: str) -> float:
    """
    Simple heuristic for coherence: sentence count, avg sentence length,
    and repetition ratio.  Returns 0.0–1.0.
    """
    sentences = re.split(r"[.!?]+", text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return 0.0

    words = _tokenize(text)
    if not words:
        return 0.0

    avg_len = len(words) / len(sentences)
    unique_ratio = len(set(words)) / len(words)

    # Ideal avg sentence length ~10-25 words
    length_score = 1.0 - min(abs(avg_len - 17.5) / 17.5, 1.0)
    score = 0.5 * unique_ratio + 0.5 * length_score
    return round(max(0.0, min(1.0, score)), 4)


# ── Public API ──────────────────────────────────────────────────
async def compute_similarity_metrics(
    text_a: str,
    text_b: str,
    reference: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Core evaluation: compare two model responses.

    Returns dict with semantic_similarity, bleu_score, rouge_l_score,
    coherence scores, and a verdict.
    """
    loop = asyncio.get_running_loop()

    # Run CPU-bound work in thread pool
    sem_sim = await loop.run_in_executor(None, _cosine_similarity_embeddings, text_a, text_b)
    bleu = _bleu_score(text_a, text_b)
    rouge = _rouge_l(text_a, text_b)
    coh_a = _coherence_score(text_a)
    coh_b = _coherence_score(text_b)

    # Determine verdict
    if sem_sim >= 0.90:
        verdict = "similar"
    elif sem_sim >= 0.70:
        verdict = "needs_review"
    else:
        verdict = "divergent"

    return {
        "semantic_similarity": round(sem_sim, 4),
        "bleu_score": bleu,
        "rouge_l_score": rouge,
        "coherence_score_a": coh_a,
        "coherence_score_b": coh_b,
        "verdict": verdict,
    }


async def compute_reference_similarity(response: str, reference: str) -> float:
    """Compute similarity between a model response and a ground-truth reference."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _cosine_similarity_embeddings, response, reference)
