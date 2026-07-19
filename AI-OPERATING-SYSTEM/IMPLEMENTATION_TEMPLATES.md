# Implementation Templates

Dokumen ini memberi pola implementasi minimum agar aturan tidak berhenti di level wacana.

## 1. Laravel Module Template

```text
app/
  Modules/
    Auth/
      Presentation/
        Controllers/
        Requests/
        Resources/
      Application/
        Actions/
        DTOs/
      Domain/
        Policies/
        Rules/
        Exceptions/
      Infrastructure/
        Repositories/
      Tests/
  Shared/
    Audit/
    Logging/
    Security/
    Support/
```

## 2. Flow Template

Contoh flow login:

1. `LoginRequest`
   validasi input boundary
2. `LoginUserAction`
   orchestration flow
3. `UserRepository`
   query user
4. `LoginRules`
   cek status akun, lockout, dan invariant lain
5. `AuditLogService`
   catat login sukses atau gagal

## 3. Class Naming

- request: `VerbNounRequest`
- action: `VerbNounAction`
- service: `NounService`
- repository: `NounRepository`
- policy: `NounPolicy`
- query service: `NounQueryService`
- command: `VerbNounCommand`

## 4. Backend Skeleton

### Request

```php
final class UpdateJobRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
        ];
    }
}
```

### Action

```php
final class UpdateJobAction
{
    public function __construct(
        private JobRepository $jobs,
        private JobPolicy $policy,
        private AuditLogService $audit,
    ) {
    }

    public function handle(User $actor, int $jobId, array $payload): Job
    {
        $job = $this->jobs->findOrFail($jobId);
        $this->policy->ensureCanUpdate($actor, $job);

        $updatedJob = $this->jobs->update($job, $payload);

        $this->audit->record('job.updated', [
            'actor_id' => $actor->id,
            'target_id' => $updatedJob->id,
        ]);

        return $updatedJob;
    }
}
```

### Controller

```php
final class JobController
{
    public function update(UpdateJobRequest $request, int $jobId): JsonResponse
    {
        $job = $this->action->handle($request->user(), $jobId, $request->validated());

        return response()->json([
            'data' => JobResource::make($job),
        ]);
    }
}
```

## 5. Audit Service Contract

```php
interface AuditLogService
{
    public function record(string $eventName, array $context): void;
}
```

Minimal context:

- `actor_id`
- `actor_role`
- `target_type`
- `target_id`
- `request_id`
- `result`

## 6. Frontend Feature Template

```text
src/
  features/
    jobs/
      components/
      hooks/
      services/
      utils/
      pages/
```

Owner:

- `components/`: render
- `hooks/`: behavior reusable
- `services/`: API adapter
- `utils/`: presentational helper
- `pages/`: page composition

## 7. Frontend API Template

```js
export async function updateJob(jobId, payload) {
  const response = await apiClient.put(`/jobs/${jobId}`, payload);
  return response.data.data;
}
```

Rule:

- service fokus ke transport
- jangan taruh quota rule inti di sini

## 8. Minimum GitHub Actions Gate

Minimal pipeline:

1. lint
2. test
3. build
4. secret scan
5. dependency scan

## 9. Minimum Test Matrix

- auth success
- auth denial
- ownership denial
- status transition valid
- status transition invalid
- upload validation
- bug fix regression
