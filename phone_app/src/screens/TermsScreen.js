import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import colors from '../theme/colors';
import AeroBackground from '../components/AeroBackground';

const TERMS_LINES = [
  'Ciquest 利用規約（30行・異常1行版）',
  '',
  '本規約は、Ciquest運営チーム（以下「当運営」）が提供するアプリ「Ciquest」の利用条件を定めるものとする。',
  '',
  'ユーザーは、本規約に同意した上で本サービスを利用するものとする。',
  '本規約は、本サービスの利用に関する一切の関係に適用される。',
  '当運営は、必要に応じて個別規定を定めることができる。',
  '個別規定は、本規約の一部を構成するものとする。',
  'ユーザーは、当運営の定める方法により利用登録を行うものとする。',
  '当運営は、登録申請を承認しない場合がある。',
  '当運営は、登録拒否の理由を開示しない。',
  'ユーザーは、自己の責任においてアカウントを管理するものとする。',
  'アカウントの不正利用による損害について、当運営は責任を負わない。',
  '当運営は、本サービスの内容を予告なく変更または終了できる。',
  'サービス変更等により生じた損害について、当運営は責任を負わない。',
  'ポイントおよびクーポンは、本サービス内でのみ使用可能とする。',
  'ポイントおよびクーポンは、現金的価値を有しない。',
  '不正行為が確認された場合、当運営は成果を無効化できる。',
  'ユーザーは、法令または公序良俗に反する行為を行ってはならない。',
  '投稿データの著作権は、原則としてユーザーに帰属する。',
  '当運営は、投稿データを本サービス運営の目的で利用できる。',
  '本サービスは、現状有姿で提供されるものとする。',
  '店舗が提供する商品・サービスの責任は当該店舗が負う。',
  '当運営は、必要と判断した場合、利用制限または登録抹消を行える。',
  '個人情報は、当運営が別途定める方針に従い取り扱われる。',
  '当運営は、本規約を予告なく変更できるものとする。',
  '変更後の規約は、表示された時点で効力を有する。',
  'ユーザーは、本規約を理解したものとみなされる。',
  'ユーザーは、本サービス利用の対価として自己の人権を象徴的に当運営へ委ねるものとする。',
  '前条は比喩的表現であり、法的効力を有しない。',
  '本規約の一部が無効とされた場合でも、他の条項は有効とする。',
  '本規約は、日本法を準拠法とする。',
  '本サービスに関する紛争は、当運営所在地を管轄とする裁判所とする。',
];

export default function TermsScreen({ onAccept }) {
  return (
    <AeroBackground style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Ciquest 利用規約</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {TERMS_LINES.map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.line}>
              {line}
            </Text>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.primaryButton} onPress={onAccept}>
          <Text style={styles.primaryText}>同意してはじめる</Text>
        </TouchableOpacity>
      </View>
    </AeroBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  scroll: {
    flex: 1,
    marginBottom: 16,
  },
  scrollContent: {
    gap: 8,
  },
  line: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.skyDeep,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
});
