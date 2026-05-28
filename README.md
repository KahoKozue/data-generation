# Social Engineering Chat Data Generator

用於資安研究的社交工程對話資料生成工具。模擬 Microsoft Teams 風格的內部對話，可批次產生具有不同攻擊特徵的合成訓練資料，並內建分析模組輔助判斷風險。

## 用途

- 資安意識訓練資料集建立
- 社交工程偵測模型的合成標註資料來源
- 紅隊演練情境設計

## 功能

**生成端**
- 可調整權威程度（A0 同事平級 / A1 代理身份 / ...）
- 可調整急迫程度與認知負載
- 可設定意圖（`malicious` / `benign`）
- 可設定訊息筆數與時間跨度
- 內建多組預設情境（技術挫折、影子 IT 等）

**分析端**
- 基於語意、語用操縱策略、情境一致性三維度評估
- 輸出可追溯的 Markdown 分析報告
- 使用 GPT-4 / Gemini 作為後端

## 技術棧

- React + TypeScript + Vite
- OpenAI API（生成與分析）
- Google Gemini API（生成）

## 快速開始

```bash
npm install
npm run dev
```

在 UI 的設定欄填入 OpenAI 或 Gemini API Key 後即可使用。

## 環境變數

```bash
cp .env.example .env
# 填入 OPENAI_API_KEY 或 GEMINI_API_KEY
```
