// ============================================================================
//  BACKEND ДЛЯ САЙТА САЙТСОТИКА
//  Полная интеграция с DonationAlerts
//  Эндпоинты:
//      /api/goal
//      /api/stats
//      /api/donations/list
//      /api/donations/latest
//      /api/donations/top
//      /api/subs/list
// ============================================================================

import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import dayjs from 'dayjs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const DA_TOKEN = process.env.DA_ACCESS_TOKEN;
const DA_API = 'https://www.donationalerts.com/api/v1';

if (!DA_TOKEN) {
    console.error('❌ ERROR: DA_ACCESS_TOKEN не указан в .env');
    process.exit(1);
}

// ============================================================================
//  Универсальная функция запроса к DonationAlerts
// ============================================================================

async function daGet(path, params = {}) {
    const url = new URL(DA_API + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    try {
        const res = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${DA_TOKEN}` }
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('❌ DonationAlerts error:', res.status, text);
            return null;
        }

        return await res.json();
    } catch (e) {
        console.error('❌ Ошибка запроса к DonationAlerts:', e);
        return null;
    }
}

// ============================================================================
//  ПОСЛЕДНИЙ ДОНАТ
// ============================================================================

app.get('/api/donations/latest', async (req, res) => {
    const data = await daGet('/alerts/donations', { page: 1 });

    if (!data || !data.data) {
        return res.json({ ok: true, latest: null });
    }

    const latest = data.data[0] || null;

    res.json({
        ok: true,
        latest: latest ? {
            username: latest.username,
            amount: latest.amount,
            currency: latest.currency,
            message: latest.message,
            created_at: latest.created_at
        } : null
    });
});

// ============================================================================
//  ПОЛНАЯ ИСТОРИЯ ДОНАТОВ (до 100)
// ============================================================================

app.get('/api/donations/list', async (req, res) => {
    const data = await daGet('/alerts/donations', { page: 1 });

    if (!data || !data.data) {
        return res.json({ ok: true, list: [] });
    }

    const list = data.data.map(d => ({
        username: d.username,
        amount: d.amount,
        currency: d.currency,
        message: d.message,
        created_at: d.created_at
    }));

    res.json({ ok: true, list });
});

// ============================================================================
//  ТОП ДОНАТ
// ============================================================================

app.get('/api/donations/top', async (req, res) => {
    const data = await daGet('/alerts/donations', { page: 1 });

    if (!data || !data.data || data.data.length === 0) {
        return res.json({ ok: true, top: null });
    }

    const top = data.data.reduce((max, d) => (d.amount > max.amount ? d : max), data.data[0]);

    res.json({
        ok: true,
        top: {
            username: top.username,
            amount: top.amount,
            currency: top.currency,
            message: top.message,
            created_at: top.created_at
        }
    });
});

// ============================================================================
//  СТАТИСТИКА: день / месяц / год
// ============================================================================

app.get('/api/stats', async (req, res) => {
    const data = await daGet('/alerts/donations', { page: 1 });

    if (!data || !data.data) {
        return res.json({
            ok: true,
            day: { sum: 0, count: 0 },
            month: { sum: 0 },
            year: { sum: 0 }
        });
    }

    const now = dayjs();
    const today = now.startOf('day');
    const monthStart = now.startOf('month');
    const yearStart = now.startOf('year');

    let sumDay = 0;
    let countDay = 0;
    let sumMonth = 0;
    let sumYear = 0;

    for (const d of data.data) {
        const t = dayjs(d.created_at);

        if (t.isAfter(today)) {
            sumDay += d.amount;
            countDay++;
        }
        if (t.isAfter(monthStart)) {
            sumMonth += d.amount;
        }
        if (t.isAfter(yearStart)) {
            sumYear += d.amount;
        }
    }

    res.json({
        ok: true,
        day: { sum: sumDay, count: countDay },
        month: { sum: sumMonth },
        year: { sum: sumYear }
    });
});

// ============================================================================
//  ЦЕЛЬ СТРИМА
// ============================================================================

app.get('/api/goal', async (req, res) => {
    const data = await daGet('/goals');

    if (!data || !data.data || data.data.length === 0) {
        return res.json({ ok: true, goal: null });
    }

    const active = data.data.find(g => g.is_active) || data.data[0];

    const progress = active.goal_amount > 0
        ? Math.round((active.raised_amount / active.goal_amount) * 100)
        : 0;

    res.json({
        ok: true,
        goal: {
            title: active.title,
            currency: active.currency,
            start_amount: active.start_amount,
            raised_amount: active.raised_amount,
            goal_amount: active.goal_amount,
            progress
        }
    });
});

// ============================================================================
//  ПОСЛЕДНИЕ ПОДПИСЧИКИ
// ============================================================================

app.get('/api/subs/list', async (req, res) => {
    const data = await daGet('/alerts/subscribe', { page: 1 });

    if (!data || !data.data) {
        return res.json({ ok: true, list: [] });
    }

    const list = data.data.map(s => ({
        username: s.username,
        created_at: s.created_at
    }));

    res.json({ ok: true, list });
});

// ============================================================================
//  СТАРТ СЕРВЕРА
// ============================================================================

app.listen(PORT, () => {
    console.log(`🔥 Sotik backend running on port ${PORT}`);
});

