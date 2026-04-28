'use server';

import {EndSessionResult, StartSessionResult} from "@/types";

type TempSession = {
    id: string;
    clerkId: string;
    bookId: string;
    startedAt: Date;
    endedAt?: Date;
    durationSeconds: number;
};

const tempSessions = new Map<string, TempSession>();

export const startVoiceSession = async (clerkId: string, bookId: string): Promise<StartSessionResult> => {
    try {
        const sessionId = crypto.randomUUID();
        tempSessions.set(sessionId, {
            id: sessionId,
            clerkId,
            bookId,
            startedAt: new Date(),
            durationSeconds: 0,
        });

        return {
            success: true,
            sessionId,
            maxDurationMinutes: 60,
        }
    } catch (e) {
        console.error('Error starting voice session', e);
        return { success: false, error: 'Failed to start voice session. Please try again later.' }
    }
}

export const endVoiceSession = async (sessionId: string, durationSeconds: number): Promise<EndSessionResult> => {
    try {
        const session = tempSessions.get(sessionId);
        if(!session) return { success: false, error: 'Voice session not found.' }

        tempSessions.set(sessionId, {
            ...session,
            endedAt: new Date(),
            durationSeconds,
        });

        return { success: true }
    } catch (e) {
        console.error('Error ending voice session', e);
        return { success: false, error: 'Failed to end voice session. Please try again later.' }
    }
}