# Competitor Price Radar: backend contract

The Pricing screen calls one authenticated endpoint:

```http
POST /api/v1/uk/pricing/competitors/search
Content-Type: application/json
```

## Request

```json
{
  "market": "UA",
  "product_net_uid": "11111111-1111-1111-1111-111111111111",
  "query": "0986AF0123 BOSCH гальмівні колодки",
  "sources": ["strans", "cargo_parts", "intercars", "omega", "tir_market"]
}
```

- `query` is required and should be trimmed by the API.
- `product_net_uid` may be `null` for a manual search.
- Unsupported sources should return `422`, not be silently ignored.
- The response must only contain evidence found during this scan or read from a time-bounded cache. The AI layer must never invent offers or prices.

## Response

```json
{
  "market": "UA",
  "currency": "UAH",
  "query": "0986AF0123 BOSCH гальмівні колодки",
  "searched_at": "2026-07-31T11:30:00Z",
  "sources_scanned": ["strans", "cargo_parts", "intercars", "omega", "tir_market"],
  "ai_summary": "Точні пропозиції концентруються біля 1 350 ₴; дві дешевші позиції мають довшу доставку.",
  "offers": [
    {
      "source": "strans",
      "marketplace_name": "STRANS",
      "seller_name": "STRANS",
      "title": "BOSCH 0986AF0123 — комплект колодок",
      "url": "https://strans-shop.com.ua/shop/product/887756",
      "price_uah": 1299.00,
      "original_price_uah": 1399.00,
      "availability": "in_stock",
      "delivery_text": "відправка сьогодні",
      "similarity_score": 0.98
    }
  ]
}
```

Allowed availability values: `in_stock`, `limited`, `out_of_stock`, `unknown`. `similarity_score` is `0.8..1`. Money fields are non-negative and rounded to kopecks. Offer URLs must be absolute HTTP(S) links.

## Implemented pipeline

1. The authorized `gba-server` PricingController forwards the request to the internal `gba-pricing` FastAPI service with `X-Internal-Api-Key`.
2. `gba-pricing` calls `claude-sonnet-5` with Anthropic `web_search_20260318`, localized to Ukraine and restricted to the five selected competitor domains. Business priority is STRANS, Cargo Parts, Inter Cars Ukraine, Омега, then TIR Market.
3. Claude runs in two server-side steps: web search with citations first, then a forced strict `return_competitor_prices` tool call over those search blocks. The production system prompt lives in `gba-ai-services/gba-pricing/app/services/competitor_prompt.py`.
4. Pydantic validates price, source, availability and similarity. A separate evidence gate keeps an offer only when its canonical URL appeared in Anthropic's actual search result or citation blocks; model-only URLs are discarded.
5. Results are deduplicated, sorted by competitor priority, similarity and price, capped at 18 offers, and cached in Redis for 15 minutes by model + normalized query + selected sources. Cargo Parts and Омега prices hidden behind B2B login are not inferred; neither authentication nor anti-bot protection is bypassed.
6. The Anthropic key remains server-side and reuses the same secret as ecommerce photo search. It must never be placed in a `VITE_*` variable or browser bundle.

The Anthropic timeout is 90 seconds and the `gba-server` PricingApi timeout must be at least 120 seconds. Cache hits preserve their original `searched_at`; synthetic offers are never generated.
