'use client';
import dynamic from 'next/dynamic';
const GymHawk = dynamic(() => import('../src/App'), { ssr: false, loading: () => <main className="app-loading" role="status">Opening Gym Hawk…</main> });
export default function Client() { return <GymHawk/>; }
