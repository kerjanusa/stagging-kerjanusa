<?php

namespace App\Requests\Message;

use App\Requests\ApiFormRequest;

class SendMessageRequest extends ApiFormRequest
{
    /**
     * Define the payload required to send one chat message.
     */
    public function rules(): array
    {
        return [
            'recipient_id' => 'required|integer|exists:users,id',
            'body' => 'required|string|max:5000',
            'job_id' => 'nullable|integer|exists:jobs,id',
        ];
    }
}
