# Parse the MariaDB HadithTable dump into TSV (all collections).
import gzip, sys, csv
ESC = {'n':'\n','r':'\r','t':'\t','0':'\0','\\':'\\',"'":"'",'"':'"','Z':'\x1a','b':'\b'}
def rows(s):
    i, n = 0, len(s)
    while i < n:
        if s[i] != '(':
            i += 1; continue
        i += 1; row = []
        while True:
            c = s[i]
            if c == "'":
                i += 1; buf = []
                while True:
                    c = s[i]
                    if c == '\\': buf.append(ESC.get(s[i+1], s[i+1])); i += 2
                    elif c == "'":
                        if s[i+1] == "'": buf.append("'"); i += 2
                        else: i += 1; break
                    else: buf.append(c); i += 1
                row.append(''.join(buf))
            else:
                j = i
                while s[j] not in ',)': j += 1
                v = s[i:j].strip(); row.append(None if v == 'NULL' else v); i = j
            if s[i] == ',': i += 1; continue
            if s[i] == ')': i += 1; break
        yield row
out = csv.writer(open('sn.csv', 'w', newline=''))
n = 0
for line in gzip.open(sys.argv[1], 'rt', encoding='utf-8'):
    if line.startswith('INSERT INTO `HadithTable` VALUES'):
        line = line[len('INSERT INTO `HadithTable` VALUES'):]
    elif not line.startswith('('):
        continue
    for r in rows(line):
        out.writerow(['\\N' if v is None else v.replace('\0','') for v in r]); n += 1
print(n, 'rows')
