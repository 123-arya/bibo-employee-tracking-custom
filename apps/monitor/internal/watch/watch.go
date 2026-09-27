// Package watch runs on the Oracle box next to bibotracking. Every interval it
// counts the service's 4xx/5xx responses over the last window (read from
// journald) and sends a Telegram alert straight from the box when a count
// reaches its threshold — no server, tunnel or listening port involved.
package watch

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os/exec"
	"sort"
	"strings"
	"time"

	"github.com/BurntSushi/toml"

	"ctracking/monitor/internal/parse"
)

type Config struct {
	Host         string `toml:"host"`
	Unit         string `toml:"unit"`
	IntervalSecs int    `toml:"interval_secs"`
	WindowMins   int    `toml:"window_mins"`
	Threshold4xx int    `toml:"threshold_4xx"`
	Threshold5xx int    `toml:"threshold_5xx"`
	RepeatMins   int    `toml:"repeat_mins"`
	Telegram     struct {
		Token  string `toml:"token"`
		ChatID string `toml:"chat_id"`
	} `toml:"telegram"`
}

func Run(cfgPath string) error {
	var cfg Config
	if _, err := toml.DecodeFile(cfgPath, &cfg); err != nil {
		return fmt.Errorf("config: %w", err)
	}
	if cfg.Unit == "" || cfg.IntervalSecs <= 0 || cfg.WindowMins <= 0 || cfg.Threshold4xx <= 0 || cfg.Threshold5xx <= 0 || cfg.RepeatMins <= 0 {
		return fmt.Errorf("config: unit, interval_secs, window_mins, threshold_4xx, threshold_5xx and repeat_mins are required")
	}
	repeat := time.Duration(cfg.RepeatMins) * time.Minute
	rules := []*rule{
		{class: 4, threshold: cfg.Threshold4xx},
		{class: 5, threshold: cfg.Threshold5xx},
	}

	log.Printf("bibomon watch: unit=%s window=%dm 4xx>=%d 5xx>=%d", cfg.Unit, cfg.WindowMins, cfg.Threshold4xx, cfg.Threshold5xx)
	notify(&cfg, fmt.Sprintf("👀 [%s] watching %s: alert at 4xx ≥ %d or 5xx ≥ %d per %dm",
		cfg.Host, cfg.Unit, cfg.Threshold4xx, cfg.Threshold5xx, cfg.WindowMins))

	ticker := time.NewTicker(time.Duration(cfg.IntervalSecs) * time.Second)
	for ; ; <-ticker.C {
		lines, err := readLines(cfg.Unit, cfg.WindowMins)
		if err != nil {
			// don't evaluate on a failed read: it would look like "0 errors" and resolve alerts
			log.Printf("journal: %v", err)
			continue
		}
		c := count(lines)
		now := time.Now()
		for _, r := range rules {
			n := c.total[r.class]
			switch r.step(n, now, repeat) {
			case fire:
				notify(&cfg, fmt.Sprintf("🔥 [%s] %s %dxx: %d in last %dm (threshold %d)\n%s",
					cfg.Host, cfg.Unit, r.class, n, cfg.WindowMins, r.threshold, c.top(r.class, 5)))
			case resolve:
				notify(&cfg, fmt.Sprintf("✅ [%s] %s %dxx back to normal: %d in last %dm",
					cfg.Host, cfg.Unit, r.class, n, cfg.WindowMins))
			}
		}
	}
}

// readLines returns the unit's journal messages from the last window minutes.
func readLines(unit string, windowMins int) ([]string, error) {
	out, err := exec.Command("journalctl", "-u", unit, "--since", fmt.Sprintf("-%dmin", windowMins),
		"-o", "cat", "--no-pager", "-q").Output()
	if err != nil {
		return nil, err
	}
	return strings.Split(string(out), "\n"), nil
}

type counts struct {
	total map[int]int            // status class (4, 5) -> requests
	byKey map[int]map[string]int // status class -> "500 POST /v1/x" -> requests
}

func count(lines []string) counts {
	c := counts{total: map[int]int{}, byKey: map[int]map[string]int{4: {}, 5: {}}}
	for _, l := range lines {
		r, ok := parse.ParseRequest(l)
		if !ok {
			continue
		}
		class := r.Status / 100
		if class != 4 && class != 5 {
			continue
		}
		c.total[class]++
		c.byKey[class][fmt.Sprintf("%d %s %s", r.Status, r.Method, r.Path)]++
	}
	return c
}

// top lists the n most frequent "status method path" entries of a class.
func (c counts) top(class, n int) string {
	m := c.byKey[class]
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		if m[keys[i]] != m[keys[j]] {
			return m[keys[i]] > m[keys[j]]
		}
		return keys[i] < keys[j]
	})
	if len(keys) > n {
		keys = keys[:n]
	}
	var b strings.Builder
	for _, k := range keys {
		fmt.Fprintf(&b, "  %d× %s\n", m[k], k)
	}
	return strings.TrimRight(b.String(), "\n")
}

type action int

const (
	none action = iota
	fire
	resolve
)

// rule tracks one status class. It fires when the count reaches the
// threshold, re-fires at most every repeat while still over, and resolves
// once the count drops back below.
type rule struct {
	class     int
	threshold int
	firing    bool
	lastSent  time.Time
}

func (r *rule) step(n int, now time.Time, repeat time.Duration) action {
	if n >= r.threshold {
		if r.firing && now.Sub(r.lastSent) < repeat {
			return none
		}
		r.firing, r.lastSent = true, now
		return fire
	}
	if r.firing {
		r.firing = false
		return resolve
	}
	return none
}

var client = &http.Client{Timeout: 15 * time.Second}

func notify(cfg *Config, text string) {
	log.Print(text)
	if cfg.Telegram.Token == "" || cfg.Telegram.ChatID == "" {
		return
	}
	resp, err := client.PostForm("https://api.telegram.org/bot"+cfg.Telegram.Token+"/sendMessage", url.Values{
		"chat_id": {cfg.Telegram.ChatID},
		"text":    {text},
	})
	if err != nil {
		log.Printf("telegram send: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("telegram send: %s", resp.Status)
	}
}
