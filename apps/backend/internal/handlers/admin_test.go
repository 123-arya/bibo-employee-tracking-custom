package handlers

import (
	"testing"

	"ctracking/backend/internal/messages"
	"ctracking/backend/internal/store"
)

func TestIsSuperAdmin(t *testing.T) {
	admins := []string{"ngnclht", "boss@example.com"}
	cases := []struct {
		u    store.User
		want bool
	}{
		{store.User{Username: "ngnclht"}, true},
		{store.User{Username: "NGNCLHT"}, true},
		{store.User{Email: "Boss@Example.com"}, true},
		{store.User{Username: "linh", Email: "linh@x.com"}, false},
		{store.User{}, false}, // empty identifiers never match
	}
	for _, c := range cases {
		if got := isSuperAdmin(c.u, admins); got != c.want {
			t.Errorf("%+v: got %v want %v", c.u, got, c.want)
		}
	}
	if isSuperAdmin(store.User{Username: "ngnclht"}, nil) {
		t.Error("no SUPER_ADMINS configured must mean nobody")
	}
}

func TestSummarize(t *testing.T) {
	fields := []messages.Field{
		{ID: "role", Type: "radio", Label: map[string]string{"en": "Role"},
			Options: []messages.Option{{Value: "dev", Label: map[string]string{"en": "Dev"}}, {Value: "pm", Label: map[string]string{"en": "PM"}}}},
		{ID: "tools", Type: "checkbox", Label: map[string]string{"en": "Tools"},
			Options: []messages.Option{{Value: "a", Label: map[string]string{"en": "A"}}, {Value: "b", Label: map[string]string{"en": "B"}}}},
		{ID: "nps", Type: "nps", Label: map[string]string{"en": "NPS"}},
		{ID: "stars", Type: "rating", Label: map[string]string{"en": "Stars"}},
		{ID: "note", Type: "textarea", Label: map[string]string{"en": "Note"}},
	}
	r := func(a map[string]any) store.MessageResponse { return store.MessageResponse{Answers: a} }
	responses := []store.MessageResponse{
		r(map[string]any{"role": "dev", "tools": []any{"a", "b"}, "nps": 10.0, "stars": 5.0, "note": "great"}),
		r(map[string]any{"role": "dev", "tools": []any{"a"}, "nps": 9.0, "stars": 4.0}),
		r(map[string]any{"role": "pm", "nps": 7.0, "stars": 3.0}),
		r(map[string]any{"role": "pm", "nps": 3.0}),
	}
	s := summarize(fields, responses)
	if s[0].Answered != 4 || s[0].Options[0].Count != 2 || s[0].Options[1].Count != 2 {
		t.Errorf("radio: %+v", s[0])
	}
	if s[1].Answered != 2 || s[1].Options[0].Count != 2 || s[1].Options[1].Count != 1 {
		t.Errorf("checkbox: %+v", s[1])
	}
	// 2 promoters, 1 passive, 1 detractor of 4 → NPS = (2-1)/4 = 25
	if s[2].NPS == nil || *s[2].NPS != 25 || *s[2].Average != 7.25 || s[2].Scale[10] != 1 {
		t.Errorf("nps: %+v nps=%v", s[2], s[2].NPS)
	}
	if s[3].Answered != 3 || *s[3].Average != 4 || s[3].NPS != nil {
		t.Errorf("rating: %+v", s[3])
	}
	if len(s[4].Texts) != 1 || s[4].Texts[0] != "great" {
		t.Errorf("text: %+v", s[4])
	}
}
