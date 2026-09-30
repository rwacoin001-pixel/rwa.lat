export interface paths {
    "/v1/ai/chat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AiController_chat"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AiCitationResponseDto: {
            id: string;
            sourceId: string;
            revision: number;
            title: string;
            locale: string;
            publishedAt: string;
        };
        AiQuestionOptionResponseDto: {
            id: string;
            label: string;
            description?: string;
        };
        AiQuestionResponseDto: {
            id: string;
            title: string;
            multiple: boolean;
            options: components["schemas"]["AiQuestionOptionResponseDto"][];
        };
        AiChatResponseDto: {
            sessionId: string;
            messageId: string;
            reply: string;
            model: string;
            createdAt: string;
            citations: components["schemas"]["AiCitationResponseDto"][];
            questions: components["schemas"]["AiQuestionResponseDto"][];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    AiController_chat: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Reply and clarification cards */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiChatResponseDto"];
                };
            };
        };
    };
}
