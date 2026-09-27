package watch

import (
	"testing"
	"time"
)

func TestCount(t *testing.T) {
	lines := []string{
		`[GIN] 2026/09/27 - 04:31:48 | 401 |       63.92µs |  45.136.253.207 | POST     "/v1/sync/batch"`,
		`[GIN] 2026/09/27 - 04:31:49 | 200 |     414.123µs |  45.136.253.207 | POST     "/v1/auth/refresh"`,
		`[GIN] 2026/09/27 - 04:31:50 | 401 |       50.1µs |  45.136.253.207 | POST     "/v1/sync/batch"`,
		`[GIN] 2026/09/27 - 04:31:51 | 400 |       50.1µs |  45.136.253.207 | POST     "/v1/sync/screenshots"`,
		`[GIN] 2026/09/27 - 04:31:52 | 500 |      2.1ms |  45.136.253.207 | POST     "/v1/sync/batch"`,
		`{"time":"2026-09-27T04:31:52Z","level":"ERROR","msg":"sync failed"}`,
		``,
	}
	c := count(lines)
	if c.total[4] != 3 || c.total[5] != 1 {
		t.Fatalf("totals = %v, want 4xx=3 5xx=1", c.total)
	}
	want := "  2× 401 POST /v1/sync/batch\n  1× 400 POST /v1/sync/screenshots"
	if got := c.top(4, 5); got != want {
		t.Errorf("top(4) =\n%s\nwant\n%s", got, want)
	}
	if got := c.top(4, 1); got != "  2× 401 POST /v1/sync/batch" {
		t.Errorf("top(4,1) = %q", got)
	}
}

func TestRuleStep(t *testing.T) {
	r := &rule{class: 5, threshold: 10}
	t0 := time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC)
	repeat := 30 * time.Minute
	steps := []struct {
		at   time.Duration
		n    int
		want action
	}{
		{0, 3, none},                 // under threshold
		{time.Minute, 10, fire},      // reaches threshold
		{2 * time.Minute, 50, none},  // still over, within repeat
		{31 * time.Minute, 12, fire}, // still over, repeat elapsed
		{32 * time.Minute, 9, resolve},
		{33 * time.Minute, 0, none},
		{34 * time.Minute, 11, fire}, // fresh incident fires immediately
	}
	for _, s := range steps {
		if got := r.step(s.n, t0.Add(s.at), repeat); got != s.want {
			t.Errorf("at %v n=%d: got %v want %v", s.at, s.n, got, s.want)
		}
	}
}
